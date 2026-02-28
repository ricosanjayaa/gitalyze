import { NextResponse } from "next/server";
import { getGroqRecommendations, getRemediationPlan } from "@/lib/groq";

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const scoreData = body?.scoreData;
  const user = body?.user;
  const repos = body?.repos;

  if (!scoreData || !user || !repos) {
    return NextResponse.json(
      { message: "Missing required fields: scoreData, user, or repos" },
      { status: 400 }
    );
  }

  const forceFallback = process.env.FORCE_AI_RECS === "true";
  if (forceFallback) {
    const fallbackPlan = getRemediationPlan(scoreData, user, repos);
    return NextResponse.json({
      recommendations: fallbackPlan,
      fallback: true,
      message: "Heuristic plan; Groq disabled",
    });
  }

  try {
    const MAXIMA: Record<string, number> = {
      activity: 25,
      quality: 30,
      volume: 15,
      diversity: 10,
      completeness: 10,
      maturity: 10,
    };

    const hasWeakCategory = Object.entries(MAXIMA).some(([k, max]) => {
      const val = scoreData?.[k] ?? 0;
      return val <= max * 0.75;
    });

    if (!hasWeakCategory) {
      return NextResponse.json({ recommendations: [] });
    }

    const recommendations = await getGroqRecommendations(user, repos, scoreData);

    if (Array.isArray(recommendations) && recommendations.length === 0) {
      const fallbackPlan = getRemediationPlan(scoreData, user, repos);
      if (fallbackPlan.length > 0) {
        return NextResponse.json({
          recommendations: fallbackPlan,
          fallback: true,
          message: "Heuristic plan (AI returned empty)",
        });
      }
    }

    return NextResponse.json({ recommendations: recommendations ?? [] });
  } catch (error: any) {
    const status = error?.status || 500;

    if (status === 429) {
      const fallbackPlan = getRemediationPlan(scoreData, user, repos);
      const payload: any = {
        message: error?.message || "Rate limit exceeded",
        error: "RATE_LIMIT",
        recommendations: fallbackPlan,
        fallback: true,
      };
      if (error?.details && typeof error.details.retryAfter !== "undefined") {
        payload.retryAfter = error.details.retryAfter;
      }
      return NextResponse.json(payload, { status: 429 });
    }

    const fallbackPlan = getRemediationPlan(scoreData, user, repos);
    if (fallbackPlan.length > 0) {
      return NextResponse.json({
        recommendations: fallbackPlan,
        fallback: true,
        message: "Heuristic plan (AI error)",
      });
    }

    return NextResponse.json({ recommendations: [] });
  }
}


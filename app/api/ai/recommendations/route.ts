import { NextResponse } from "next/server";
import { getGroqRecommendations, getRemediationPlan } from "@/lib/groq";
import type { Deficiency, RecommendationItem } from "@/lib/recommendation";

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
  const deficiencies = (body?.deficiencies ?? []) as Deficiency[];
  const actions = (body?.actions ?? []) as RecommendationItem[];

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

  if (Array.isArray(actions) && actions.length > 0 && !process.env.GROQ_API_KEY) {
    return NextResponse.json({ recommendations: actions.map((a) => a.text), fallback: true, message: "AI disabled" });
  }

  try {
    const MAXIMA: Record<string, number> = {
      activity: 20,
      quality: 25,
      depth: 15,
      impact: 15,
      consistency: 15,
      completeness: 10,
    };

    const hasWeakCategory = Object.entries(MAXIMA).some(([k, max]) => {
      const val = scoreData?.[k] ?? 0;
      return val <= max * 0.75;
    });

    if (!hasWeakCategory) {
      return NextResponse.json({ recommendations: [] });
    }

    const recommendations = await getGroqRecommendations(user, repos, scoreData, {
      deficiencies: Array.isArray(deficiencies) ? deficiencies : [],
      actions: Array.isArray(actions) ? actions : [],
    });

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

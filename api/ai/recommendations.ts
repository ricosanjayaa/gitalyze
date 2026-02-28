import { readJsonBody, sendJson } from '../_lib/http';
import { getGroqRecommendations, getRemediationPlan } from '../../src/lib/groq';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  const body = await readJsonBody(req);
  const scoreData = body?.scoreData;
  const user = body?.user;
  const repos = body?.repos;

  if (!scoreData || !user || !repos) {
    return sendJson(res, 400, { message: 'Missing required fields: scoreData, user, or repos' });
  }

  const forceFallback = process.env.FORCE_AI_RECS === 'true';
  if (forceFallback) {
    const fallbackPlan = getRemediationPlan(scoreData, user, repos);
    return sendJson(res, 200, {
      recommendations: fallbackPlan,
      fallback: true,
      message: 'Heuristic plan; Groq disabled',
    });
  }

  try {
    // Skip AI if all category scores are strong.
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
      return sendJson(res, 200, { recommendations: [] });
    }

    const recommendations = await getGroqRecommendations(user, repos, scoreData);

    if (Array.isArray(recommendations) && recommendations.length === 0) {
      const fallbackPlan = getRemediationPlan(scoreData, user, repos);
      if (fallbackPlan.length > 0) {
        return sendJson(res, 200, {
          recommendations: fallbackPlan,
          fallback: true,
          message: 'Heuristic plan (AI returned empty)',
        });
      }
    }

    return sendJson(res, 200, { recommendations: recommendations ?? [] });
  } catch (error: any) {
    const status = error?.status || 500;

    if (status === 429) {
      const fallbackPlan = getRemediationPlan(scoreData, user, repos);
      const payload: any = {
        message: error?.message || 'Rate limit exceeded',
        error: 'RATE_LIMIT',
        recommendations: fallbackPlan,
        fallback: true,
      };
      if (error?.details && typeof error.details.retryAfter !== 'undefined') {
        payload.retryAfter = error.details.retryAfter;
      }
      return sendJson(res, 429, payload);
    }

    const fallbackPlan = getRemediationPlan(scoreData, user, repos);
    if (fallbackPlan.length > 0) {
      return sendJson(res, 200, {
        recommendations: fallbackPlan,
        fallback: true,
        message: 'Heuristic plan (AI error)',
      });
    }

    return sendJson(res, 200, { recommendations: [] });
  }
}


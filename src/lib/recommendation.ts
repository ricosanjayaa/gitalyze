import { GoogleGenAI, Type } from "@google/genai";
import { ScoreBreakdown } from "./scoring";
import { GitHubUser, GitHubRepo } from "./github";

export async function getAIRecoomendations(
  breakdown: ScoreBreakdown, 
  user: GitHubUser, 
  repos: GitHubRepo[]
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are a strict GitHub profile evaluator and optimization expert.

    Your task is to generate improvement recommendations ONLY for weak areas based on the provided data.

    CRITICAL RULES:

    1. Only recommend improvements for sections with LOW scores.
      - If a score is >= 70% of its maximum, DO NOT suggest improvements for it.
      - If a profile field already exists, DO NOT suggest adding it.

    2. Never give generic advice.
      - Every recommendation must directly relate to the provided data.
      - Do not assume missing information unless explicitly stated.

    3. If all sections are strong, return an empty array.

    4. Generate 3–4 recommendations maximum.

    5. Each recommendation:
      - One sentence only
      - Maximum 20 words
      - Start with a strong verb (Add, Improve, Increase, Pin, Enhance, Expand, Strengthen, Optimize, Document, Engage)
      - Professional, concise, and constructive tone
      - No criticism, only forward-looking advice

    --------------------------------------------------

    USER DATA:

    Name: ${user.name || user.login}
    Bio: ${user.bio || 'Not provided'}
    Location: ${user.location || 'Not provided'}
    Website: ${user.blog || 'Not provided'}
    Followers: ${user.followers}
    Public Repos: ${user.public_repos}

    SCORES:
    Activity: ${breakdown.activity.toFixed(0)} / 25
    Quality: ${breakdown.quality.toFixed(0)} / 30
    Volume: ${breakdown.volume.toFixed(0)} / 15
    Diversity: ${breakdown.diversity.toFixed(0)} / 10
    Completeness: ${breakdown.completeness.toFixed(0)} / 10

    TOP REPOSITORIES:
    ${repos.sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 3).map(r => `- ${r.name} (${r.stargazers_count} stars): ${r.description || 'No description'}`).join('\n')}

    --------------------------------------------------
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];

    const recommendations = JSON.parse(text);
    return Array.isArray(recommendations) ? recommendations : [];

  } catch (error: any) {
    console.error("Gemini API error:", error);
    if (error.message?.includes("429") || error.message?.includes("limit")) {
      throw new Error("API has reached its limit, please try again later.");
    }
    throw new Error("Something went wrong while generating recommendations.");
  }
}

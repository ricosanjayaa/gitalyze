export type RecommendationActionId =
  | "ADD_BIO"
  | "ADD_PROFILE_DETAILS"
  | "CREATE_REAL_PROJECT"
  | "ADD_README"
  | "ADD_DESCRIPTION_TOPICS"
  | "ADD_LICENSE"
  | "CUT_A_RELEASE"
  | "MAKE_RECENT_COMMIT";

export interface RecommendationAction {
  id: RecommendationActionId;
  title: string;
  why: string;
  steps: string[];
  effort: number; // 0..1
  impact: number; // 0..1
}

export const ACTIONS: Record<RecommendationActionId, RecommendationAction> = {
  ADD_BIO: {
    id: "ADD_BIO",
    title: "Add a clear profile bio",
    why: "A short bio helps people understand what you build and makes your profile feel complete.",
    steps: [
      "Write 1–2 sentences about what you’re learning/building right now.",
      "Mention your main stack (1–2 technologies) and what type of projects you like shipping.",
      "Add one link (portfolio, blog, or a best repo) if you have it.",
    ],
    effort: 0.1,
    impact: 0.6,
  },
  ADD_PROFILE_DETAILS: {
    id: "ADD_PROFILE_DETAILS",
    title: "Fill in key profile details",
    why: "Location/links make it easier for collaborators or recruiters to contact you.",
    steps: ["Add location (optional).", "Add a website/blog link if you have one.", "Add a display name for consistency."],
    effort: 0.1,
    impact: 0.4,
  },
  CREATE_REAL_PROJECT: {
    id: "CREATE_REAL_PROJECT",
    title: "Ship 1 real project repository",
    why: "A real project demonstrates learning progress more than a profile-only repo.",
    steps: [
      "Pick a small problem you can finish in 1–2 weekends.",
      "Create a repo with a minimal working MVP (screenshots optional).",
      "Add a roadmap (3–5 checkboxes) and complete at least one follow-up task.",
    ],
    effort: 0.7,
    impact: 0.9,
  },
  ADD_README: {
    id: "ADD_README",
    title: "Add a README to your top project",
    why: "A README explains what the project does and how to run it—this is one of the strongest portfolio signals.",
    steps: [
      "Add a short description + screenshot/demo.",
      "Include install/run steps and basic usage.",
      "List features and a small roadmap or known limitations.",
    ],
    effort: 0.3,
    impact: 0.85,
  },
  ADD_DESCRIPTION_TOPICS: {
    id: "ADD_DESCRIPTION_TOPICS",
    title: "Improve discoverability (description + topics)",
    why: "Descriptions and topics help people find and quickly understand your repos.",
    steps: ["Add a 1-line repo description.", "Add 3–5 relevant topics.", "Pin 3–6 best repos to your profile."],
    effort: 0.2,
    impact: 0.6,
  },
  ADD_LICENSE: {
    id: "ADD_LICENSE",
    title: "Add an open-source license",
    why: "A license makes your project reusable and signals professionalism.",
    steps: ["Pick a license (MIT is a good default).", "Add the LICENSE file via GitHub UI.", "Mention it in the README."],
    effort: 0.2,
    impact: 0.55,
  },
  CUT_A_RELEASE: {
    id: "CUT_A_RELEASE",
    title: "Publish a first release",
    why: "Releases show you can ship versions and maintain a project over time.",
    steps: ["Tag v0.1.0.", "Write release notes (what changed + what’s next).", "Repeat when you add meaningful features."],
    effort: 0.35,
    impact: 0.6,
  },
  MAKE_RECENT_COMMIT: {
    id: "MAKE_RECENT_COMMIT",
    title: "Make one small update this week",
    why: "Recent activity is a strong signal that you’re actively learning and building.",
    steps: ["Pick your best repo.", "Fix one issue or add one small feature.", "Write a short commit message explaining the change."],
    effort: 0.25,
    impact: 0.7,
  },
};


import type { ActivityType, BadgeCategory, Tier, UserRole } from "../../generated/prisma/enums.js";

/**
 * Points are earned only for actions that create value for someone else (a session held,
 * a question answered), and spammable actions have a daily limit so points cannot be farmed.
 */
export const POINT_RULES: Record<ActivityType, { points: number; dailyLimit?: number; isOncePerReference?: boolean }> = {
  PROFILE_COMPLETED: { points: 25, isOncePerReference: true },
  SESSION_COMPLETED: { points: 50, isOncePerReference: true },
  SESSION_ATTENDED: { points: 20, isOncePerReference: true },
  FIVE_STAR_RATING_RECEIVED: { points: 15, isOncePerReference: true },
  FEEDBACK_GIVEN: { points: 5, isOncePerReference: true },
  SPACE_HOSTED: { points: 40, isOncePerReference: true },
  SPACE_ATTENDED: { points: 10, dailyLimit: 3, isOncePerReference: true },
  QUESTION_ASKED: { points: 3, dailyLimit: 10 },
  QUESTION_ANSWERED: { points: 5, dailyLimit: 20, isOncePerReference: true },
  POST_CREATED: { points: 10, dailyLimit: 3, isOncePerReference: true },
  COMMENT_CREATED: { points: 2, dailyLimit: 10 },
  REACTION_RECEIVED: { points: 1, dailyLimit: 25 },
  MESSAGE_REQUEST_ACCEPTED: { points: 5, dailyLimit: 10, isOncePerReference: true },
  // Points for awards are passed explicitly (see AWARD_POINTS).
  AWARD_WON: { points: 0, isOncePerReference: true },
};

/** Lifetime points needed to reach each membership tier. */
export const TIER_THRESHOLDS: { tier: Tier; minPoints: number }[] = [
  { tier: "PLATINUM", minPoints: 5000 },
  { tier: "GOLD", minPoints: 2000 },
  { tier: "SILVER", minPoints: 500 },
  { tier: "BRONZE", minPoints: 0 },
];

export function tierForPoints(points: number): Tier {
  return TIER_THRESHOLDS.find((threshold) => points >= threshold.minPoints)!.tier;
}

/** Counters the badge engine can measure for a user. */
export type BadgeMetric =
  | "sessionsMentored"
  | "sessionsAttended"
  | "fiveStarRatings"
  | "spacesHosted"
  | "spacesAttended"
  | "questionsAsked"
  | "postsCreated"
  | "commentsCreated"
  | "reactionsReceived"
  | "connections"
  | "signupRank";

export interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  tier: Tier;
  role: UserRole | null;
  metric: BadgeMetric;
  /** Earned when metric >= threshold (or <= threshold for signupRank). */
  threshold: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Mentorship (alumni)
  { code: "MENTOR_BRONZE", name: "First Mentee", description: "Completed your first mentorship session", icon: "🌱", category: "MENTORSHIP", tier: "BRONZE", role: "ALUMNI", metric: "sessionsMentored", threshold: 1 },
  { code: "MENTOR_SILVER", name: "Trusted Mentor", description: "Completed 10 mentorship sessions", icon: "🧭", category: "MENTORSHIP", tier: "SILVER", role: "ALUMNI", metric: "sessionsMentored", threshold: 10 },
  { code: "MENTOR_GOLD", name: "Master Mentor", description: "Completed 25 mentorship sessions", icon: "🏅", category: "MENTORSHIP", tier: "GOLD", role: "ALUMNI", metric: "sessionsMentored", threshold: 25 },
  { code: "MENTOR_PLATINUM", name: "Legendary Mentor", description: "Completed 50 mentorship sessions", icon: "👑", category: "MENTORSHIP", tier: "PLATINUM", role: "ALUMNI", metric: "sessionsMentored", threshold: 50 },
  { code: "TOP_RATED_GOLD", name: "Crowd Favourite", description: "Received 10 five-star ratings", icon: "⭐", category: "MENTORSHIP", tier: "GOLD", role: "ALUMNI", metric: "fiveStarRatings", threshold: 10 },

  // Spaces (alumni)
  { code: "SPACE_HOST_BRONZE", name: "Mic Check", description: "Hosted your first space", icon: "🎙️", category: "SPACES", tier: "BRONZE", role: "ALUMNI", metric: "spacesHosted", threshold: 1 },
  { code: "SPACE_HOST_SILVER", name: "Space Host", description: "Hosted 5 spaces", icon: "📡", category: "SPACES", tier: "SILVER", role: "ALUMNI", metric: "spacesHosted", threshold: 5 },
  { code: "SPACE_HOST_GOLD", name: "Space Captain", description: "Hosted 15 spaces", icon: "🚀", category: "SPACES", tier: "GOLD", role: "ALUMNI", metric: "spacesHosted", threshold: 15 },
  { code: "SPACE_HOST_PLATINUM", name: "Space Legend", description: "Hosted 30 spaces", icon: "🌌", category: "SPACES", tier: "PLATINUM", role: "ALUMNI", metric: "spacesHosted", threshold: 30 },

  // Timeline (alumni)
  { code: "AUTHOR_BRONZE", name: "First Post", description: "Published your first post", icon: "✍️", category: "COMMUNITY", tier: "BRONZE", role: "ALUMNI", metric: "postsCreated", threshold: 1 },
  { code: "AUTHOR_SILVER", name: "Storyteller", description: "Published 10 posts", icon: "📖", category: "COMMUNITY", tier: "SILVER", role: "ALUMNI", metric: "postsCreated", threshold: 10 },
  { code: "INFLUENCER_GOLD", name: "Crowd Mover", description: "Received 100 reactions on your posts", icon: "🔥", category: "COMMUNITY", tier: "GOLD", role: "ALUMNI", metric: "reactionsReceived", threshold: 100 },

  // Learning (students)
  { code: "LEARNER_BRONZE", name: "First Session", description: "Attended your first mentorship session", icon: "🎓", category: "MENTORSHIP", tier: "BRONZE", role: "STUDENT", metric: "sessionsAttended", threshold: 1 },
  { code: "LEARNER_SILVER", name: "Eager Learner", description: "Attended 5 mentorship sessions", icon: "📚", category: "MENTORSHIP", tier: "SILVER", role: "STUDENT", metric: "sessionsAttended", threshold: 5 },
  { code: "LEARNER_GOLD", name: "Lifelong Learner", description: "Attended 15 mentorship sessions", icon: "🧠", category: "MENTORSHIP", tier: "GOLD", role: "STUDENT", metric: "sessionsAttended", threshold: 15 },
  { code: "QUESTIONER_BRONZE", name: "Hand Raiser", description: "Asked your first question in a space", icon: "✋", category: "SPACES", tier: "BRONZE", role: "STUDENT", metric: "questionsAsked", threshold: 1 },
  { code: "QUESTIONER_SILVER", name: "Curious Mind", description: "Asked 10 questions in spaces", icon: "❓", category: "SPACES", tier: "SILVER", role: "STUDENT", metric: "questionsAsked", threshold: 10 },
  { code: "QUESTIONER_GOLD", name: "Question Master", description: "Asked 25 questions in spaces", icon: "🔍", category: "SPACES", tier: "GOLD", role: "STUDENT", metric: "questionsAsked", threshold: 25 },
  { code: "LISTENER_SILVER", name: "Space Explorer", description: "Joined 5 live spaces", icon: "🛰️", category: "SPACES", tier: "SILVER", role: "STUDENT", metric: "spacesAttended", threshold: 5 },
  { code: "COMMENTER_BRONZE", name: "Conversationalist", description: "Left 10 comments on posts", icon: "💬", category: "COMMUNITY", tier: "BRONZE", role: "STUDENT", metric: "commentsCreated", threshold: 10 },

  // Everyone
  { code: "NETWORKER_SILVER", name: "Networker", description: "Made 5 connections through message requests", icon: "🤝", category: "COMMUNITY", tier: "SILVER", role: null, metric: "connections", threshold: 5 },
  { code: "NETWORKER_GOLD", name: "Super Connector", description: "Made 20 connections through message requests", icon: "🌐", category: "COMMUNITY", tier: "GOLD", role: null, metric: "connections", threshold: 20 },
  { code: "EARLY_ADOPTER", name: "Early Adopter", description: "One of the first 100 members of PAU Network", icon: "🚀", category: "MILESTONE", tier: "PLATINUM", role: null, metric: "signupRank", threshold: 100 },
];

/** Bonus points that come with each award. */
export const AWARD_POINTS = {
  ALUMNI_OF_THE_MONTH: 200,
  STUDENT_OF_THE_MONTH: 100,
  DEPARTMENT_CHAMPION_OF_THE_MONTH: 75,
  ALUMNI_OF_THE_YEAR: 1000,
  RISING_STAR_OF_THE_YEAR: 500,
  SPACE_OF_THE_YEAR: 300,
  STUDENTS_CHOICE_OF_THE_YEAR: 500,
} as const;

import type { BookingTopic, EmploymentType, ReactionType, Tier, UserSummary } from "./types";

const TIME_ZONE = "Africa/Lagos";

export const fullName = (user: Pick<UserSummary, "firstName" | "lastName">) => `${user.firstName} ${user.lastName}`;
export const initials = (user: Pick<UserSummary, "firstName" | "lastName">) => `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

/** "Tue 13 Oct · 6:00 PM WAT" */
export function formatSlot(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE });
  return `${day} · ${formatTime(iso)} WAT`;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE });
}

export function formatMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatMonthLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "3m", "5h", "2d", or a date. */
export function timeAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** LinkedIn-style duration: "Mar 2022 – Present · 4 yrs 7 mos" */
export function formatTenure(startIso: string, endIso: string | null) {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years && `${years} yr${years > 1 ? "s" : ""}`, rest && `${rest} mo${rest > 1 ? "s" : ""}`].filter(Boolean).join(" ");
  return `${formatMonthYear(startIso)} – ${endIso ? formatMonthYear(endIso) : "Present"} · ${parts || "1 mo"}`;
}

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "LIKE", emoji: "👍", label: "Like" },
  { type: "LOVE", emoji: "❤️", label: "Love" },
  { type: "CELEBRATE", emoji: "🎉", label: "Celebrate" },
  { type: "INSIGHTFUL", emoji: "💡", label: "Insightful" },
  { type: "FUNNY", emoji: "😂", label: "Funny" },
  { type: "SUPPORT", emoji: "🤝", label: "Support" },
];
export const reactionEmoji = (type: ReactionType) => REACTIONS.find((reaction) => reaction.type === type)!.emoji;

export const TIER_LABEL: Record<Tier, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum" };
/** Tailwind classes per tier; colours come from theme.ts (tierBronze, …). */
export const TIER_CLASSES: Record<Tier, { text: string; bg: string; ring: string; badge: string }> = {
  BRONZE: { text: "text-tier-bronze", bg: "bg-tier-bronze", ring: "ring-tier-bronze", badge: "bg-tier-bronze text-white" },
  SILVER: { text: "text-tier-silver", bg: "bg-tier-silver", ring: "ring-tier-silver", badge: "bg-tier-silver text-slate-900" },
  GOLD: { text: "text-tier-gold", bg: "bg-tier-gold", ring: "ring-tier-gold", badge: "bg-tier-gold text-slate-900" },
  PLATINUM: { text: "text-tier-platinum", bg: "bg-tier-platinum", ring: "ring-tier-platinum", badge: "bg-tier-platinum text-white" },
};

export const TOPIC_LABEL: Record<BookingTopic, string> = {
  CAREER_ADVICE: "Career advice",
  CV_REVIEW: "CV review",
  INTERNSHIPS: "Internships",
  COURSE_ADVICE: "Course advice",
  INTERVIEW_PREP: "Interview prep",
  OTHER: "Other",
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  SELF_EMPLOYED: "Self-employed",
  VOLUNTEER: "Volunteer",
};

export const ACTIVITY_LABEL: Record<string, string> = {
  PROFILE_COMPLETED: "Completed your profile",
  SESSION_COMPLETED: "Mentored a student",
  SESSION_ATTENDED: "Attended a session",
  FIVE_STAR_RATING_RECEIVED: "Received a 5-star rating",
  FEEDBACK_GIVEN: "Left session feedback",
  SPACE_HOSTED: "Hosted a space",
  SPACE_ATTENDED: "Joined a space",
  QUESTION_ASKED: "Asked a question",
  QUESTION_ANSWERED: "Answered a question",
  POST_CREATED: "Published a post",
  COMMENT_CREATED: "Commented on a post",
  REACTION_RECEIVED: "Someone reacted to your post",
  MESSAGE_REQUEST_ACCEPTED: "Accepted a message request",
  AWARD_WON: "Won an award",
};

export const SPACE_REACTION_EMOJIS = ["👏", "❤️", "🔥", "😂", "💡", "🙌", "🎉", "👍"];

/** Common emojis for the composer / comment picker. */
export const EMOJI_PICKER = ["😀", "😂", "🥹", "😍", "🤩", "😎", "🤔", "🙏", "👏", "🙌", "💪", "👍", "❤️", "🔥", "🎉", "🚀", "💡", "📚", "🎓", "💼", "📈", "✅", "💯", "✨", "🤝", "📣", "🎙️", "🏆", "⭐", "🇳🇬"];

export const studentLevelLabel = (level: number | null) => (level ? `${level}L` : "");

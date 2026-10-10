// Mirrors the backend API (camelCase JSON, enums in SCREAMING_SNAKE_CASE, ISO 8601 date strings).

export type UserRole = "STUDENT" | "ALUMNI" | "ADMIN";
export type Tier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
export type BookingStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "COMPLETED";
export type BookingTopic = "CAREER_ADVICE" | "CV_REVIEW" | "INTERNSHIPS" | "COURSE_ADVICE" | "INTERVIEW_PREP" | "OTHER";
export type ConversationStatus = "PENDING" | "ACCEPTED" | "DECLINED";
export type ReactionType = "LIKE" | "LOVE" | "CELEBRATE" | "INSIGHTFUL" | "FUNNY" | "SUPPORT";
export type SpaceStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
export type SpaceParticipantRole = "HOST" | "SPEAKER" | "LISTENER";
export type SpaceQuestionStatus = "OPEN" | "ANSWERED" | "DISMISSED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "SELF_EMPLOYED" | "VOLUNTEER";
export type AwardType =
  | "ALUMNI_OF_THE_MONTH"
  | "ALUMNI_OF_THE_YEAR"
  | "STUDENT_OF_THE_MONTH"
  | "RISING_STAR_OF_THE_YEAR"
  | "DEPARTMENT_CHAMPION_OF_THE_MONTH"
  | "SPACE_OF_THE_YEAR"
  | "STUDENTS_CHOICE_OF_THE_YEAR";

export interface Department {
  id: string;
  name: string;
  slug: string;
  school: string;
  alumniCount?: number;
}

/** Compact user shape used on posts, comments, messages and spaces. */
export interface UserSummary {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  headline: string | null;
  jobTitle: string | null;
  company: string | null;
  isVerified: boolean;
  tier: Tier;
  department?: Pick<Department, "id" | "name">;
}

export interface User extends UserSummary {
  email?: string;
  bannerUrl: string | null;
  bio: string | null;
  skills: string[];
  graduationYear: number;
  studentLevel: number | null;
  industry: string | null;
  location: string | null;
  linkedinUrl: string | null;
  points: number;
  createdAt: string;
  department: Department;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  employmentType: EmploymentType;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface Education {
  id: string;
  school: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number;
  endYear: number | null;
  description: string | null;
}

export interface Profile extends User {
  experiences: Experience[];
  educations: Education[];
  isFollowing: boolean;
  stats: {
    followerCount: number;
    followingCount: number;
    postCount: number;
    spacesHostedCount: number;
    sessionsCompletedCount: number;
    averageRating: number | null;
    ratingCount: number;
  };
}

export interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  status?: "OPEN" | "HELD" | "BOOKED";
}

export interface DirectoryUser extends User {
  nextOpenSlot: Slot | null;
}

export interface Booking {
  id: string;
  topic: BookingTopic;
  message: string;
  status: BookingStatus;
  declineReason: string | null;
  meetingUrl: string | null;
  rating: number | null;
  feedback: string | null;
  createdAt: string;
  slot: Slot;
  student: UserSummary & { studentLevel: number | null; department: Pick<Department, "id" | "name"> };
  alumni: UserSummary;
  studentId: string;
  alumniId: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  requesterId: string;
  recipientId: string;
  status: ConversationStatus;
  lastMessageAt: string | null;
  createdAt: string;
  otherUser: UserSummary;
  lastMessage: Message | null;
  unreadCount: number;
}

export type ReactionCounts = Partial<Record<ReactionType, number>>;

export interface Post {
  id: string;
  body: string;
  imageUrl: string | null;
  commentCount: number;
  reactionCount: number;
  createdAt: string;
  author: UserSummary;
  reactionCounts: ReactionCounts;
  viewerReaction: ReactionType | null;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  author: UserSummary;
  replies: Comment[];
  viewerReaction: ReactionType | null;
  reactionCount: number;
}

export interface SpaceParticipant {
  spaceId: string;
  userId: string;
  role: SpaceParticipantRole;
  isHandRaised: boolean;
  handRaisedAt: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  user: UserSummary;
}

export interface SpaceQuestion {
  id: string;
  spaceId: string;
  body: string;
  status: SpaceQuestionStatus;
  upvoteCount: number;
  createdAt: string;
  author: UserSummary;
  hasViewerUpvoted?: boolean;
}

export interface Space {
  id: string;
  title: string;
  description: string | null;
  status: SpaceStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  startedAt: string | null;
  endedAt: string | null;
  capacity: number;
  host: UserSummary;
  hostId: string;
  department: Pick<Department, "id" | "name"> | null;
  participantCount: number;
  questionCount?: number;
  isRegistered?: boolean;
}

export interface SpaceDetail extends Space {
  meetingUrl: string | null;
  participants: SpaceParticipant[];
  questions: SpaceQuestion[];
  viewer: { role: SpaceParticipantRole | null; isRegistered: boolean; isInRoom: boolean; isHandRaised: boolean };
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: "MENTORSHIP" | "SPACES" | "COMMUNITY" | "MILESTONE";
  tier: Tier;
  role: UserRole | null;
  awardedAt?: string;
  earnedCount?: number;
  threshold?: number;
}

export interface Award {
  id: string;
  type: AwardType;
  title: string;
  periodStart: string;
  periodEnd: string;
  score: number;
  citation: string;
  recipient: UserSummary;
  department: Pick<Department, "id" | "name"> | null;
}

export interface Achievements {
  points: number;
  tier: Tier;
  nextTier: { tier: Tier; minPoints: number; pointsNeeded: number } | null;
  badges: Badge[];
  awards: Award[];
  recentPointTransactions: { id: string; activityType: string; points: number; createdAt: string }[];
}

export interface LeaderboardRow {
  rank: number;
  points: number;
  user: UserSummary;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

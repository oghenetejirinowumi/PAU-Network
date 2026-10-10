/**
 * Seeds PAU Network with demo data. ALL PEOPLE ARE FICTIONAL.
 * Employers are real Nigerian companies used only for realism; LinkedIn URLs use a "pau-demo-" prefix.
 *
 * Run: npm run db:seed   (password for every account: demo1234)
 * Awards are computed afterwards by prisma/seed-awards.ts (also run by db:seed).
 */
import bcrypt from "bcryptjs";
import type { ActivityType, BookingTopic, ReactionType } from "../src/generated/prisma/enums.js";
import { prisma } from "../src/lib/prisma.js";
import { BADGE_DEFINITIONS, POINT_RULES, tierForPoints } from "../src/modules/gamification/gamification.config.js";
import { evaluateBadges } from "../src/modules/gamification/gamification.service.js";

// ───── Helpers ─────

/** Deterministic pseudo-random numbers so every seed run produces the same data. */
function createRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = createRandom(2026);
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = new Date();

/** A time `daysFromToday` days away at the given WAT (UTC+1) wall-clock time. */
function watTime(daysFromToday: number, hour: number, minute = 0) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromToday, hour - 1, minute));
  return date;
}

const email = (first: string, last: string) => `${first}.${last}`.toLowerCase() + "@pau-network.demo";
const linkedin = (first: string, last: string) => `https://www.linkedin.com/in/pau-demo-${first}-${last}`.toLowerCase();

// ───── Reference data ─────

const DEPARTMENTS = [
  { slug: "computer-science", name: "Computer Science", school: "School of Science and Technology" },
  { slug: "software-engineering", name: "Software Engineering", school: "School of Science and Technology" },
  { slug: "mechanical-engineering", name: "Mechanical Engineering", school: "School of Science and Technology" },
  { slug: "electrical-engineering", name: "Electrical and Electronic Engineering", school: "School of Science and Technology" },
  { slug: "accounting", name: "Accounting", school: "School of Management and Social Sciences" },
  { slug: "economics", name: "Economics", school: "School of Management and Social Sciences" },
  { slug: "business-administration", name: "Business Administration", school: "School of Management and Social Sciences" },
  { slug: "philosophy", name: "Philosophy", school: "School of Management and Social Sciences" },
  { slug: "mass-communication", name: "Mass Communication", school: "School of Media and Communication" },
  { slug: "mba", name: "MBA", school: "Lagos Business School" },
];

interface AlumniSeed {
  key: string;
  firstName: string;
  lastName: string;
  department: string;
  graduationYear: number;
  jobTitle: string;
  company: string;
  industry: string;
  location: string;
  isVerified: boolean;
  headline: string;
  bio: string;
  /** 0..1, how active this alumnus is in the generated history */
  activity: number;
  /** Open slots: [days from today, WAT hour, minute] */
  slots: [number, number, number?][];
}

const ALUMNI: AlumniSeed[] = [
  { key: "chinedu", firstName: "Chinedu", lastName: "Okafor", department: "computer-science", graduationYear: 2018, jobTitle: "Senior Software Engineer", company: "Paystack", industry: "Fintech", location: "Lagos", isVerified: true, activity: 0.95, headline: "Backend, System design, Internships", bio: "Fintech engineer. I help students move from tutorials to production code and land backend internships.", slots: [[1, 18], [2, 18], [4, 10], [8, 18]] },
  { key: "ifeanyi", firstName: "Ifeanyi", lastName: "Obi", department: "computer-science", graduationYear: 2017, jobTitle: "Data Scientist", company: "Microsoft ADC Lagos", industry: "Technology", location: "Lagos", isVerified: true, activity: 0.7, headline: "Data science, Python, Grad school", bio: "I build ML models for Microsoft products. Ask me about data science, Python, and applying for a master's abroad.", slots: [[2, 19], [5, 11], [9, 19]] },
  { key: "funmilayo", firstName: "Funmilayo", lastName: "Adebayo", department: "software-engineering", graduationYear: 2022, jobTitle: "Mobile Engineer", company: "Moniepoint", industry: "Fintech", location: "Lagos", isVerified: false, activity: 0.6, headline: "Flutter, Mobile, First job", bio: "I build mobile apps used by millions of merchants. Happy to help you land your first tech job.", slots: [[1, 17], [3, 17], [6, 12]] },
  { key: "kunle", firstName: "Kunle", lastName: "Adewale", department: "software-engineering", graduationYear: 2023, jobTitle: "Frontend Engineer", company: "Andela", industry: "Technology", location: "Remote", isVerified: false, activity: 0.5, headline: "React, Remote work, Portfolios", bio: "Remote frontend engineer. I review portfolios and explain how to work for global teams from Lagos.", slots: [[2, 16], [4, 16], [7, 16]] },
  { key: "emeka", firstName: "Emeka", lastName: "Nwosu", department: "mechanical-engineering", graduationYear: 2021, jobTitle: "Design Engineer", company: "Dangote Group", industry: "Manufacturing", location: "Lagos", isVerified: true, activity: 0.55, headline: "CAD, Sustainable energy, SIWES", bio: "Design engineer working on plant efficiency. Let's talk CAD, SIWES placements and engineering careers.", slots: [[3, 18, 30], [10, 18, 30]] },
  { key: "uche", firstName: "Uche", lastName: "Okonkwo", department: "mechanical-engineering", graduationYear: 2017, jobTitle: "Maintenance Engineer", company: "Seplat Energy", industry: "Oil and gas", location: "Lagos", isVerified: true, activity: 0.35, headline: "Oil and gas, COREN, Field work", bio: "Ten years in oil and gas maintenance. I can explain field work, COREN registration and graduate schemes.", slots: [[5, 19], [12, 19]] },
  { key: "oluwaseun", firstName: "Oluwaseun", lastName: "Ajayi", department: "electrical-engineering", graduationYear: 2020, jobTitle: "Field Engineer", company: "Schneider Electric", industry: "Energy", location: "Abuja", isVerified: true, activity: 0.45, headline: "Power systems, Renewables, Interviews", bio: "I install and maintain power systems across the North. Interested in renewables? Let's talk.", slots: [[1, 20], [6, 20], [13, 20]] },
  { key: "zainab", firstName: "Zainab", lastName: "Mohammed", department: "accounting", graduationYear: 2016, jobTitle: "Audit Manager", company: "KPMG Nigeria", industry: "Professional services", location: "Lagos", isVerified: true, activity: 0.65, headline: "ICAN, Audit, Big Four recruiting", bio: "Big Four audit manager. I help students prepare for ICAN and for Big Four recruitment tests.", slots: [[4, 19, 30], [11, 19, 30]] },
  { key: "halima", firstName: "Halima", lastName: "Yusuf", department: "accounting", graduationYear: 2018, jobTitle: "Tax Consultant", company: "Deloitte Nigeria", industry: "Professional services", location: "Lagos", isVerified: true, activity: 0.5, headline: "Tax, ACCA, CV review", bio: "Tax consultant and ACCA holder. I review CVs and explain professional exams step by step.", slots: [[2, 12, 30], [9, 12, 30], [9, 13]] },
  { key: "ngozi", firstName: "Ngozi", lastName: "Adeyemi", department: "economics", graduationYear: 2019, jobTitle: "Financial Analyst", company: "GTBank", industry: "Banking", location: "Lagos", isVerified: true, activity: 0.75, headline: "Financial modelling, Banking, Excel", bio: "Data-driven finance professional. I can guide you on breaking into banking and building models in Excel.", slots: [[1, 19], [3, 19], [8, 10]] },
  { key: "babajide", firstName: "Babajide", lastName: "Ogunleye", department: "economics", graduationYear: 2014, jobTitle: "Investment Analyst", company: "Stanbic IBTC", industry: "Investment", location: "Lagos", isVerified: true, activity: 0.4, headline: "Investment banking, CFA, Markets", bio: "Twelve years in investment banking. Ask me about the CFA, markets and the first two years on the job.", slots: [[6, 9], [13, 9]] },
  { key: "tunde", firstName: "Tunde", lastName: "Balogun", department: "business-administration", graduationYear: 2015, jobTitle: "Product Manager", company: "Flutterwave", industry: "Fintech", location: "Lagos", isVerified: true, activity: 0.85, headline: "Product management, Mock interviews, CV review", bio: "Building payment products for Africa. I review CVs and run mock product-manager interviews.", slots: [[1, 12], [2, 12], [5, 18], [7, 18]] },
  { key: "adaeze", firstName: "Adaeze", lastName: "Nnamdi", department: "business-administration", graduationYear: 2021, jobTitle: "Brand Manager", company: "Unilever Nigeria", industry: "FMCG", location: "Lagos", isVerified: true, activity: 0.6, headline: "Marketing, Graduate trainee schemes", bio: "I manage household brands. Ask me about FMCG graduate trainee programmes and marketing careers.", slots: [[3, 13], [10, 13]] },
  { key: "femi", firstName: "Femi", lastName: "Oyelaran", department: "philosophy", graduationYear: 2016, jobTitle: "Associate", company: "Templars", industry: "Law", location: "Lagos", isVerified: true, activity: 0.3, headline: "Law school, Writing, Critical thinking", bio: "From philosophy to corporate law. I explain law school, writing well and how to think like a lawyer.", slots: [[4, 18], [11, 18]] },
  { key: "aisha", firstName: "Aisha", lastName: "Abubakar", department: "mass-communication", graduationYear: 2020, jobTitle: "PR Manager", company: "MTN Nigeria", industry: "Telecoms", location: "Lagos", isVerified: true, activity: 0.8, headline: "PR, Crisis comms, Portfolios", bio: "Storyteller in telecoms PR. I care about crisis communication and helping students build a portfolio.", slots: [[1, 15], [2, 15], [6, 15]] },
  { key: "chiamaka", firstName: "Chiamaka", lastName: "Eze", department: "mass-communication", graduationYear: 2019, jobTitle: "Broadcast Producer", company: "Channels TV", industry: "Media", location: "Lagos", isVerified: true, activity: 0.55, headline: "Broadcast, Journalism, Video production", bio: "I produce live news. Ask me about broadcast journalism, internships at TV stations and shooting video.", slots: [[5, 10], [12, 10]] },
  { key: "ebiere", firstName: "Ebiere", lastName: "Tamuno", department: "mba", graduationYear: 2012, jobTitle: "Strategy Lead", company: "Shell Nigeria", industry: "Energy", location: "Port Harcourt", isVerified: true, activity: 0.45, headline: "Strategy, Leadership, MBA admissions", bio: "LBS MBA, now leading strategy in energy. I advise on MBA admissions and moving into leadership.", slots: [[7, 8], [14, 8]] },
];

const STUDENTS = [
  { key: "david", firstName: "David", lastName: "Olawale", department: "computer-science", studentLevel: 300, graduationYear: 2028, headline: "300L CS · Backend, Internships", bio: "300L CS student looking for advice on backend engineering internships." },
  { key: "fatima", firstName: "Fatima", lastName: "Bello", department: "mass-communication", studentLevel: 300, graduationYear: 2028, headline: "300L Mass Comm · Broadcast, PR", bio: "Aspiring broadcast journalist seeking mentorship on entering the PR space." },
  { key: "kelechi", firstName: "Kelechi", lastName: "Eze", department: "business-administration", studentLevel: 200, graduationYear: 2029, headline: "200L Business Admin · Product, Fintech", bio: "Interested in fintech product management." },
  { key: "tolu", firstName: "Tolu", lastName: "Akinwale", department: "software-engineering", studentLevel: 400, graduationYear: 2027, headline: "400L Software Eng · Mobile, First job", bio: "Final-year SE student deciding between mobile and backend for my first role." },
  { key: "amara", firstName: "Amara", lastName: "Okeke", department: "economics", studentLevel: 100, graduationYear: 2030, headline: "100L Economics · Banking, Excel", bio: "First-year economics student curious about banking careers." },
  { key: "ibrahim", firstName: "Ibrahim", lastName: "Sani", department: "mechanical-engineering", studentLevel: 200, graduationYear: 2030, headline: "200L Mechanical Eng · Sustainable energy, SIWES", bio: "Mechanical engineering student interested in sustainable energy." },
];

/** Earlier roles per alumnus: [title, company, startYear, endYear, employmentType?]. The current role comes from ALUMNI. */
const PAST_ROLES: Record<string, [string, string, number, number, ("INTERNSHIP" | "FULL_TIME")?][]> = {
  chinedu: [["Software Engineer", "Interswitch", 2019, 2022], ["Backend Engineering Intern", "Andela", 2017, 2017, "INTERNSHIP"]],
  ifeanyi: [["Data Analyst", "MTN Nigeria", 2018, 2021], ["Research Assistant", "Pan-Atlantic University", 2016, 2017, "INTERNSHIP"]],
  funmilayo: [["Junior Mobile Developer", "Kuda", 2022, 2024], ["Software Engineering Intern", "Paystack", 2021, 2021, "INTERNSHIP"]],
  kunle: [["Frontend Intern", "Cowrywise", 2022, 2022, "INTERNSHIP"]],
  emeka: [["Graduate Trainee Engineer", "Nigerian Breweries", 2021, 2023], ["SIWES Intern", "Julius Berger", 2019, 2019, "INTERNSHIP"]],
  uche: [["Field Engineer", "Schlumberger", 2017, 2021]],
  oluwaseun: [["Electrical Engineer", "Eko Electricity Distribution", 2020, 2023]],
  zainab: [["Senior Auditor", "PwC Nigeria", 2016, 2021], ["Audit Intern", "Ernst & Young", 2015, 2015, "INTERNSHIP"]],
  halima: [["Tax Associate", "KPMG Nigeria", 2018, 2022]],
  ngozi: [["Graduate Analyst", "Access Bank", 2019, 2022], ["Summer Intern", "Stanbic IBTC", 2018, 2018, "INTERNSHIP"]],
  babajide: [["Associate", "FBNQuest", 2014, 2019], ["Analyst", "Chapel Hill Denham", 2019, 2022]],
  tunde: [["Associate Product Manager", "Interswitch", 2016, 2019], ["Business Analyst", "Accenture Nigeria", 2015, 2016]],
  adaeze: [["Management Trainee", "Nestlé Nigeria", 2021, 2023]],
  femi: [["Trainee Associate", "Aluko & Oyebode", 2019, 2021]],
  aisha: [["Communications Executive", "Ogilvy Africa", 2020, 2023], ["PR Intern", "BHM Group", 2019, 2019, "INTERNSHIP"]],
  chiamaka: [["Reporter", "TVC News", 2019, 2022], ["Newsroom Intern", "Channels TV", 2018, 2018, "INTERNSHIP"]],
  ebiere: [["Strategy Analyst", "McKinsey & Company", 2012, 2016], ["Business Development Manager", "Oando", 2016, 2021]],
};

/** Extra degrees beyond PAU: [school, degree, field, startYear, endYear]. */
const OTHER_EDUCATION: Record<string, [string, string, string, number, number][]> = {
  ifeanyi: [["University of Edinburgh", "MSc", "Data Science", 2021, 2022]],
  babajide: [["CFA Institute", "CFA Charterholder", "Investment Management", 2016, 2019]],
  ebiere: [["University of Port Harcourt", "BSc", "Economics", 2004, 2008]],
};

const PROGRAMME_YEARS = (department: string) => (department.includes("engineering") ? 5 : department === "mba" ? 2 : 4);

const POSTS: { author: string; daysAgo: number; body: string }[] = [
  { author: "chinedu", daysAgo: 0.2, body: "🚀 Going live in a few minutes: an AMA on breaking into backend engineering. Bring your questions about internships, system design and your first production bug. Join from the Spaces tab!" },
  { author: "aisha", daysAgo: 1, body: "PR tip for Mass Comm students 📣: start a portfolio NOW. Three press releases, one crisis-response plan and one campaign case study will set you apart from 90% of applicants. Happy to review yours this week." },
  { author: "tunde", daysAgo: 2, body: "Product management is not about having ideas 💡. It's about deciding which problems are worth solving. If you're curious about PM, I'm hosting a space on Thursday. RSVP and drop your questions early!" },
  { author: "ngozi", daysAgo: 3, body: "Excel shortcut that saved me hours this week 📊: Ctrl + Shift + L toggles filters. Small things compound. Economics students, learn your tools early." },
  { author: "zainab", daysAgo: 4, body: "Big Four recruitment season opens next month 🗓️. Read the firm's annual report, practise numerical reasoning daily, and prepare one story about teamwork under pressure. You've got this 💪" },
  { author: "ifeanyi", daysAgo: 5, body: "Thinking about a master's abroad? 🎓 Start your statement of purpose 6 months before deadlines, not 6 weeks. I'm happy to share the template that worked for me. Send a message request." },
  { author: "emeka", daysAgo: 6, body: "Proud moment 🎉: our team just cut energy use at the plant by 12%. Mechanical Eng students, sustainability is the future of our field. Ask me about SIWES placements!" },
  { author: "adaeze", daysAgo: 8, body: "FMCG graduate trainee applications are open at several companies 🛒. The assessment centre is where most people fall off. Practise group exercises with friends. PAU teaches you to argue well, use it!" },
  { author: "chiamaka", daysAgo: 9, body: "Behind the scenes at a live news broadcast 📺: 14 people, 3 cameras, 1 very calm producer (me, pretending). If you want to get into broadcast, internships are the door. Ask me how." },
  { author: "ebiere", daysAgo: 11, body: "Is an MBA worth it? 🤔 It depends on what you want it to unlock. I'll share my honest take, LBS and all, in a space next week." },
  { author: "kunle", daysAgo: 12, body: "Your portfolio should show 3 projects you can explain deeply, not 15 tutorials 🧑‍💻. Quality beats quantity every time." },
  { author: "halima", daysAgo: 14, body: "ACCA or ICAN? 📚 Both are great. Choose based on where you want to work in 5 years. Happy to talk it through in a session." },
];

const COMMENTS = [
  "This is so helpful, thank you! 🙏",
  "Saving this for later 📌",
  "Exactly what I needed to hear this week 💯",
  "Would love to join the session! 🙋",
  "Great advice, sharing with my classmates 🔥",
  "Thank you for always looking out for PAU students ❤️",
  "Could you share more about how you got started? 🤔",
  "Booked a session with you, looking forward to it! 🎉",
];

const TOPICS: BookingTopic[] = ["CAREER_ADVICE", "CV_REVIEW", "INTERNSHIPS", "COURSE_ADVICE", "INTERVIEW_PREP"];
const REACTION_TYPES: ReactionType[] = ["LIKE", "LOVE", "CELEBRATE", "INSIGHTFUL", "SUPPORT", "LIKE", "INSIGHTFUL"];

// ───── Seed ─────

async function main() {
  console.log("Clearing existing data…");
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.awardVote.deleteMany(),
    prisma.award.deleteMany(),
    prisma.userBadge.deleteMany(),
    prisma.badge.deleteMany(),
    prisma.pointTransaction.deleteMany(),
    prisma.spaceQuestionVote.deleteMany(),
    prisma.spaceQuestion.deleteMany(),
    prisma.spaceParticipant.deleteMany(),
    prisma.space.deleteMany(),
    prisma.reaction.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.post.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.availabilitySlot.deleteMany(),
    prisma.follow.deleteMany(),
    prisma.experience.deleteMany(),
    prisma.education.deleteMany(),
    prisma.user.deleteMany(),
    prisma.department.deleteMany(),
  ]);

  console.log("Departments and badges…");
  await prisma.department.createMany({ data: DEPARTMENTS });
  const departmentIdBySlug = new Map((await prisma.department.findMany()).map((department) => [department.slug, department.id]));
  await prisma.badge.createMany({
    data: BADGE_DEFINITIONS.map(({ metric: _metric, threshold: _threshold, ...badge }) => badge),
  });

  console.log("Users…");
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const signupBase = new Date(Date.UTC(2025, 0, 6));
  const userId = new Map<string, string>();

  const admin = await prisma.user.create({
    data: { email: "admin@pau-network.demo", passwordHash, role: "ADMIN", firstName: "PAU", lastName: "Admin", departmentId: departmentIdBySlug.get("mba")!, graduationYear: 2010, createdAt: signupBase },
  });
  userId.set("admin", admin.id);

  for (const [index, alumnus] of ALUMNI.entries()) {
    const { key, department, activity: _activity, slots: _slots, ...profile } = alumnus;
    const user = await prisma.user.create({
      data: {
        ...profile,
        role: "ALUMNI",
        email: email(profile.firstName, profile.lastName),
        passwordHash,
        departmentId: departmentIdBySlug.get(department)!,
        linkedinUrl: linkedin(profile.firstName, profile.lastName),
        skills: profile.headline.split(",").map((skill) => skill.trim()),
        createdAt: new Date(signupBase.getTime() + (index + 1) * HOUR),
        lastActiveAt: new Date(now.getTime() - random() * 2 * DAY),
      },
    });
    userId.set(key, user.id);

    const currentStart = Math.max(alumnus.graduationYear, ...(PAST_ROLES[key] ?? []).map((role) => role[3]));
    await prisma.experience.createMany({
      data: [
        { userId: user.id, title: alumnus.jobTitle, company: alumnus.company, location: alumnus.location, startDate: new Date(Date.UTC(currentStart, 2, 1)), description: alumnus.bio },
        ...(PAST_ROLES[key] ?? []).map(([title, company, startYear, endYear, employmentType]) => ({
          userId: user.id, title, company, employmentType: employmentType ?? "FULL_TIME", location: "Lagos",
          startDate: new Date(Date.UTC(startYear, employmentType === "INTERNSHIP" ? 5 : 1, 1)),
          endDate: new Date(Date.UTC(endYear, employmentType === "INTERNSHIP" ? 8 : 11, 1)),
        })),
      ],
    });
    await prisma.education.createMany({
      data: [
        { userId: user.id, school: "Pan-Atlantic University", degree: department === "mba" ? "MBA" : "Bachelor's degree", fieldOfStudy: DEPARTMENTS.find((item) => item.slug === department)!.name, startYear: alumnus.graduationYear - PROGRAMME_YEARS(department), endYear: alumnus.graduationYear },
        ...(OTHER_EDUCATION[key] ?? []).map(([school, degree, fieldOfStudy, startYear, endYear]) => ({ userId: user.id, school, degree, fieldOfStudy, startYear, endYear })),
      ],
    });
  }
  for (const [index, student] of STUDENTS.entries()) {
    const { key, department, ...profile } = student;
    const user = await prisma.user.create({
      data: {
        ...profile,
        role: "STUDENT",
        email: email(profile.firstName, profile.lastName),
        passwordHash,
        departmentId: departmentIdBySlug.get(department)!,
        linkedinUrl: linkedin(profile.firstName, profile.lastName),
        createdAt: new Date(signupBase.getTime() + (ALUMNI.length + index + 1) * HOUR),
        lastActiveAt: new Date(now.getTime() - random() * DAY),
        skills: profile.headline.split("·")[1].split(",").map((skill) => skill.trim()),
        educations: {
          create: { school: "Pan-Atlantic University", degree: "Bachelor's degree", fieldOfStudy: DEPARTMENTS.find((item) => item.slug === department)!.name, startYear: profile.graduationYear - PROGRAMME_YEARS(department), endYear: profile.graduationYear },
        },
      },
    });
    userId.set(key, user.id);
  }
  const id = (key: string) => userId.get(key)!;
  const studentKeys = STUDENTS.map((student) => student.key);

  // Students follow alumni from their department plus a few popular ones.
  const follows = new Set<string>();
  for (const student of STUDENTS) {
    for (const alumnus of ALUMNI) {
      if (alumnus.department === student.department || ["chinedu", "tunde", "aisha"].includes(alumnus.key)) {
        follows.add(`${id(student.key)}|${id(alumnus.key)}`);
      }
    }
  }
  await prisma.follow.createMany({ data: [...follows].map((pair) => ({ followerId: pair.split("|")[0], followingId: pair.split("|")[1] })) });

  // ───── History: Jan 2025 → yesterday ─────
  console.log("Generating 20 months of activity history…");
  const ledger: { userId: string; activityType: ActivityType; points: number; referenceId?: string; createdAt: Date }[] = [];
  const earn = (user: string, activityType: ActivityType, createdAt: Date, referenceId?: string, points = POINT_RULES[activityType].points) =>
    ledger.push({ userId: user, activityType, points, referenceId, createdAt });

  const historyStart = Date.UTC(2025, 0, 10);
  const historyEnd = now.getTime() - 2 * DAY;
  for (const alumnus of ALUMNI) {
    const usedStarts = new Set<number>();
    for (let month = new Date(historyStart); month.getTime() < historyEnd; month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 10))) {
      // Sessions: 0..4 per month depending on activity level
      const sessions = Math.round(alumnus.activity * 4 * (0.4 + random() * 0.8));
      for (let index = 0; index < sessions; index++) {
        const startsAt = new Date(month.getTime() + Math.floor(random() * 18) * DAY + (17 + Math.floor(random() * 3)) * HOUR);
        if (startsAt.getTime() > historyEnd || usedStarts.has(startsAt.getTime())) continue;
        usedStarts.add(startsAt.getTime());
        const slot = await prisma.availabilitySlot.create({ data: { alumniId: id(alumnus.key), startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000), createdAt: new Date(startsAt.getTime() - 5 * DAY) } });
        const studentKey = pick(studentKeys);
        const rating = random() < 0.75 ? 5 : 4;
        const booking = await prisma.booking.create({
          data: {
            slotId: slot.id, studentId: id(studentKey), alumniId: id(alumnus.key), topic: pick(TOPICS),
            message: "Thank you for making time for students. I would love your advice on my next steps.",
            status: "COMPLETED", meetingUrl: "https://meet.jit.si/PAU-Network-history", rating, feedback: rating === 5 ? "Super practical, thank you!" : "Very helpful session.",
            respondedAt: new Date(startsAt.getTime() - 3 * DAY), createdAt: new Date(startsAt.getTime() - 4 * DAY),
          },
        });
        earn(id(alumnus.key), "SESSION_COMPLETED", startsAt, booking.id);
        earn(id(studentKey), "SESSION_ATTENDED", startsAt, booking.id);
        earn(id(studentKey), "FEEDBACK_GIVEN", startsAt, booking.id);
        if (rating === 5) earn(id(alumnus.key), "FIVE_STAR_RATING_RECEIVED", startsAt, booking.id);
      }
      // Posts and reactions received
      const postCount = Math.round(alumnus.activity * 3 * random());
      for (let index = 0; index < postCount; index++) {
        const createdAt = new Date(month.getTime() + Math.floor(random() * 20) * DAY);
        if (createdAt.getTime() > historyEnd) continue;
        earn(id(alumnus.key), "POST_CREATED", createdAt);
        for (let reaction = 0; reaction < Math.round(random() * 8); reaction++) earn(id(alumnus.key), "REACTION_RECEIVED", createdAt);
      }
      // Spaces: active alumni host one most months
      if (random() < alumnus.activity * 0.6) {
        const startsAt = new Date(month.getTime() + Math.floor(random() * 18) * DAY + 18 * HOUR);
        if (startsAt.getTime() < historyEnd) {
          const attendees = studentKeys.filter(() => random() < 0.6);
          const space = await prisma.space.create({
            data: {
              hostId: id(alumnus.key), departmentId: departmentIdBySlug.get(alumnus.department), title: `${alumnus.headline.split(",")[0]} Q&A with ${alumnus.firstName}`,
              description: `Open Q&A with ${alumnus.firstName} ${alumnus.lastName} (${alumnus.jobTitle}, ${alumnus.company}).`,
              status: "ENDED", scheduledStartAt: startsAt, scheduledEndAt: new Date(startsAt.getTime() + HOUR), startedAt: startsAt, endedAt: new Date(startsAt.getTime() + HOUR),
              roomName: `PAU-Network-Space-h${Math.floor(random() * 1e12).toString(16)}`, createdAt: new Date(startsAt.getTime() - 7 * DAY),
              participants: {
                create: [
                  { userId: id(alumnus.key), role: "HOST", joinedAt: startsAt, leftAt: new Date(startsAt.getTime() + HOUR) },
                  ...attendees.map((key) => ({ userId: id(key), role: "LISTENER" as const, joinedAt: startsAt, leftAt: new Date(startsAt.getTime() + HOUR) })),
                ],
              },
            },
          });
          earn(id(alumnus.key), "SPACE_HOSTED", startsAt, space.id);
          for (const key of attendees) {
            earn(id(key), "SPACE_ATTENDED", startsAt, space.id);
            if (random() < 0.5) {
              const question = await prisma.spaceQuestion.create({ data: { spaceId: space.id, authorId: id(key), body: "What would you do differently if you were a PAU student today?", status: "ANSWERED", upvoteCount: Math.floor(random() * 5), answeredAt: startsAt, createdAt: startsAt } });
              earn(id(key), "QUESTION_ASKED", startsAt, question.id);
              earn(id(alumnus.key), "QUESTION_ANSWERED", startsAt, question.id);
            }
          }
        }
      }
    }
  }
  await prisma.pointTransaction.createMany({ data: ledger });

  // ───── Current state (relative to today) ─────
  console.log("Open availability, current bookings, posts, spaces, messages…");
  const openSlotId = new Map<string, string>();
  for (const alumnus of ALUMNI) {
    for (const [days, hour, minute = 0] of alumnus.slots) {
      const startsAt = watTime(days, hour, minute);
      const slot = await prisma.availabilitySlot.create({ data: { alumniId: id(alumnus.key), startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000) } });
      openSlotId.set(`${alumnus.key}|${days}|${hour}:${minute}`, slot.id);
    }
  }

  const sampleBookings = [
    { student: "david", alumni: "chinedu", slot: "chinedu|2|18:0", topic: "INTERNSHIPS" as const, message: "I'm in 300L CS and want a backend internship next summer. How should I prepare?", status: "PENDING" as const },
    { student: "fatima", alumni: "aisha", slot: "aisha|1|15:0", topic: "CAREER_ADVICE" as const, message: "I'd love to understand how you moved from Mass Comm into corporate PR.", status: "ACCEPTED" as const },
    { student: "kelechi", alumni: "tunde", slot: "tunde|1|12:0", topic: "CV_REVIEW" as const, message: "Could you review my CV for product internships at fintechs?", status: "PENDING" as const },
    { student: "amara", alumni: "ngozi", slot: "ngozi|1|19:0", topic: "COURSE_ADVICE" as const, message: "Which electives should I take if I want to work in banking?", status: "DECLINED" as const, declineReason: "Clash with work travel, please pick another slot" },
  ];
  for (const sample of sampleBookings) {
    const booking = await prisma.booking.create({
      data: {
        slotId: openSlotId.get(sample.slot)!, studentId: id(sample.student), alumniId: id(sample.alumni), topic: sample.topic, message: sample.message,
        status: sample.status, declineReason: sample.declineReason, respondedAt: sample.status === "PENDING" ? null : new Date(now.getTime() - 2 * HOUR),
      },
    });
    if (booking.status === "ACCEPTED") await prisma.booking.update({ where: { id: booking.id }, data: { meetingUrl: `https://meet.jit.si/PAU-Network-${booking.id}` } });
  }
  // Tolu's completed session with Funmilayo three days ago
  {
    const startsAt = watTime(-3, 17);
    const slot = await prisma.availabilitySlot.create({ data: { alumniId: id("funmilayo"), startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000) } });
    const booking = await prisma.booking.create({
      data: { slotId: slot.id, studentId: id("tolu"), alumniId: id("funmilayo"), topic: "CAREER_ADVICE", message: "Final year SE student, deciding between mobile and backend for my first role.", status: "COMPLETED", rating: 5, feedback: "Super practical, thank you!", meetingUrl: "https://meet.jit.si/PAU-Network-tolu-funmilayo", respondedAt: new Date(startsAt.getTime() - DAY) },
    });
    await prisma.pointTransaction.createMany({
      data: [
        { userId: id("funmilayo"), activityType: "SESSION_COMPLETED", points: 50, referenceId: booking.id, createdAt: startsAt },
        { userId: id("funmilayo"), activityType: "FIVE_STAR_RATING_RECEIVED", points: 15, referenceId: booking.id, createdAt: startsAt },
        { userId: id("tolu"), activityType: "SESSION_ATTENDED", points: 20, referenceId: booking.id, createdAt: startsAt },
        { userId: id("tolu"), activityType: "FEEDBACK_GIVEN", points: 5, referenceId: booking.id, createdAt: startsAt },
      ],
    });
  }

  // Timeline posts with comments and emoji reactions
  for (const post of POSTS) {
    const createdAt = new Date(now.getTime() - post.daysAgo * DAY);
    const created = await prisma.post.create({ data: { authorId: id(post.author), body: post.body, createdAt } });
    const reactors = [...studentKeys, ...ALUMNI.map((alumnus) => alumnus.key)].filter((key) => key !== post.author && random() < 0.45);
    await prisma.reaction.createMany({ data: reactors.map((key) => ({ userId: id(key), postId: created.id, type: pick(REACTION_TYPES), createdAt })) });
    const commenters = studentKeys.filter(() => random() < 0.35);
    for (const [index, key] of commenters.entries()) {
      await prisma.comment.create({ data: { postId: created.id, authorId: id(key), body: pick(COMMENTS), createdAt: new Date(createdAt.getTime() + (index + 1) * HOUR) } });
    }
    await prisma.post.update({ where: { id: created.id }, data: { reactionCount: reactors.length, commentCount: commenters.length } });
    await prisma.pointTransaction.create({ data: { userId: id(post.author), activityType: "POST_CREATED", points: 10, referenceId: created.id, createdAt } });
  }

  // A live space right now, plus upcoming ones
  const liveStartedAt = new Date(now.getTime() - 10 * 60 * 1000);
  const liveSpace = await prisma.space.create({
    data: {
      hostId: id("chinedu"), departmentId: departmentIdBySlug.get("computer-science"), title: "Breaking into backend engineering: AMA",
      description: "Internships, system design, and surviving your first production incident. Raise your hand to come on stage, or drop a question below.",
      status: "LIVE", scheduledStartAt: liveStartedAt, scheduledEndAt: new Date(liveStartedAt.getTime() + HOUR), startedAt: liveStartedAt, capacity: 100, roomName: "PAU-Network-Space-backend-ama",
      participants: {
        create: [
          { userId: id("chinedu"), role: "HOST", joinedAt: liveStartedAt },
          { userId: id("ifeanyi"), role: "SPEAKER", joinedAt: liveStartedAt },
          { userId: id("tolu"), role: "LISTENER", joinedAt: new Date(liveStartedAt.getTime() + 60 * 1000), isHandRaised: true, handRaisedAt: new Date(now.getTime() - 3 * 60 * 1000) },
          { userId: id("kelechi"), role: "LISTENER", joinedAt: new Date(liveStartedAt.getTime() + 2 * 60 * 1000) },
          { userId: id("ibrahim"), role: "LISTENER", joinedAt: new Date(liveStartedAt.getTime() + 4 * 60 * 1000) },
        ],
      },
    },
  });
  const liveQuestions = [
    { author: "tolu", body: "How did you get your first backend internship without prior experience?", upvoters: ["kelechi", "ibrahim"] },
    { author: "kelechi", body: "Which language should I learn first for backend: Go, Java or Node.js?", upvoters: ["tolu"] },
    { author: "ibrahim", body: "Can a mechanical engineering student switch into software engineering?", upvoters: [] },
  ];
  for (const question of liveQuestions) {
    const created = await prisma.spaceQuestion.create({ data: { spaceId: liveSpace.id, authorId: id(question.author), body: question.body, upvoteCount: question.upvoters.length } });
    await prisma.spaceQuestionVote.createMany({ data: question.upvoters.map((key) => ({ questionId: created.id, userId: id(key) })) });
  }

  const upcomingSpaces = [
    { host: "aisha", days: 2, hour: 18, department: "mass-communication", title: "Building a PR portfolio from scratch", description: "What to put in it, how to present it, and the mistakes I see most often. Bring your work!", registrants: ["fatima"] },
    { host: "tunde", days: 5, hour: 19, department: "business-administration", title: "Product management 101 for students", description: "What PMs actually do, how to get your first PM internship, and a live mock interview.", registrants: ["kelechi", "david", "tolu"] },
    { host: "ebiere", days: 7, hour: 17, department: "mba", title: "Is an MBA worth it? An honest conversation", description: "LBS, timing, funding and what an MBA can and can't unlock.", registrants: ["amara"] },
    { host: "zainab", days: 9, hour: 19, department: "accounting", title: "Cracking Big Four recruitment", description: "Online tests, assessment centres and interviews, step by step.", registrants: [] },
  ];
  for (const upcoming of upcomingSpaces) {
    const scheduledStartAt = watTime(upcoming.days, upcoming.hour);
    await prisma.space.create({
      data: {
        hostId: id(upcoming.host), departmentId: departmentIdBySlug.get(upcoming.department), title: upcoming.title, description: upcoming.description,
        scheduledStartAt, scheduledEndAt: new Date(scheduledStartAt.getTime() + HOUR), roomName: `PAU-Network-Space-${upcoming.host}-${upcoming.days}`,
        participants: { create: [{ userId: id(upcoming.host), role: "HOST" }, ...upcoming.registrants.map((key) => ({ userId: id(key) }))] },
      },
    });
  }

  // Message requests and conversations
  const conversations = [
    { requester: "david", recipient: "chinedu", status: "ACCEPTED" as const, messages: [["david", "Hi Chinedu! I'm a 300L CS student. Could I ask a few questions about Paystack's internship programme? 🙏"], ["chinedu", "Of course, David! Applications usually open in January. Start building one solid backend project now 💪"], ["david", "Thank you! I've booked a session with you too 🎉"]] },
    { requester: "amara", recipient: "babajide", status: "ACCEPTED" as const, messages: [["amara", "Good evening sir, I'm in 100L Economics and really interested in investment banking. Where should I start?"], ["babajide", "Great question, Amara. Start with reading the financial pages daily and learn Excel properly. We can talk more in a session 📈"]] },
    { requester: "fatima", recipient: "chiamaka", status: "PENDING" as const, messages: [["fatima", "Hi Chiamaka! I love your work at Channels 📺. Could I ask how you got your first newsroom internship?"]] },
    { requester: "kelechi", recipient: "tunde", status: "PENDING" as const, messages: [["kelechi", "Hello Tunde, I'm a 200L Business Admin student. Would you be open to a quick chat about PM careers? 😊"]] },
    { requester: "ibrahim", recipient: "emeka", status: "ACCEPTED" as const, messages: [["ibrahim", "Hi Emeka, I'd love advice on getting a SIWES placement at Dangote."], ["emeka", "Happy to help! Send me your CV and let's plan it out ⚙️"]] },
  ];
  for (const [index, conversation] of conversations.entries()) {
    const start = new Date(now.getTime() - (index + 1) * DAY);
    await prisma.conversation.create({
      data: {
        requesterId: id(conversation.requester), recipientId: id(conversation.recipient), status: conversation.status,
        respondedAt: conversation.status === "ACCEPTED" ? new Date(start.getTime() + HOUR) : null,
        lastMessageAt: new Date(start.getTime() + conversation.messages.length * HOUR), createdAt: start,
        messages: {
          create: conversation.messages.map(([sender, body], messageIndex) => ({
            senderId: id(sender), body, createdAt: new Date(start.getTime() + messageIndex * HOUR), readAt: messageIndex < conversation.messages.length - 1 ? new Date() : null,
          })),
        },
      },
    });
  }

  // Votes for this year's awards
  const voteFor: [string, string][] = [["david", "chinedu"], ["tolu", "chinedu"], ["kelechi", "tunde"], ["fatima", "aisha"], ["amara", "ngozi"], ["ibrahim", "emeka"]];
  await prisma.awardVote.createMany({
    data: voteFor.flatMap(([voter, nominee]) => [
      { awardType: "STUDENTS_CHOICE_OF_THE_YEAR" as const, year: now.getUTCFullYear(), voterId: id(voter), nomineeId: id(nominee) },
      { awardType: "ALUMNI_OF_THE_YEAR" as const, year: now.getUTCFullYear(), voterId: id(voter), nomineeId: id(nominee) },
    ]),
  });

  // ───── Totals, tiers, badges, awards ─────
  console.log("Points, tiers and badges…");
  const totals = await prisma.pointTransaction.groupBy({ by: ["userId"], _sum: { points: true } });
  for (const total of totals) {
    const points = total._sum.points ?? 0;
    await prisma.user.update({ where: { id: total.userId }, data: { points, tier: tierForPoints(points) } });
  }
  for (const key of userId.keys()) await evaluateBadges(id(key));

  // Seeding generated notifications for history; keep only a fresh, believable inbox.
  await prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } } });
  await prisma.notification.deleteMany({ where: { type: { in: ["BADGE_EARNED", "TIER_REACHED", "AWARD_WON"] } } });

  const counts = await Promise.all([prisma.user.count(), prisma.booking.count(), prisma.space.count(), prisma.post.count(), prisma.award.count(), prisma.userBadge.count()]);
  console.log(`Done: ${counts[0]} users, ${counts[1]} bookings, ${counts[2]} spaces, ${counts[3]} posts, ${counts[4]} awards, ${counts[5]} badges earned.`);
  console.log("Next: awards (prisma/seed-awards.ts). Log in with any seeded email, e.g. david.olawale@pau-network.demo / demo1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

const schedulerIntervalMs = 30 * 1000;
const claimTimeoutMs = 5 * 60 * 1000;
const reminderPageSize = 50;
const reminders = [
  {
    leadTimeMs: 60 * 60 * 1000,
    label: "1 hour",
    sentField: "reminderOneHourSentAt",
    claimedField: "reminderOneHourClaimedAt",
  },
  {
    leadTimeMs: 15 * 60 * 1000,
    label: "15 minutes",
    sentField: "reminder15MinSentAt",
    claimedField: "reminder15MinClaimedAt",
  },
] as const;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

async function sendReminderEmail(input: {
  email: string;
  firstName: string;
  title: string;
  reminderLabel: string;
  startsAt: Date;
  hostName: string;
  spaceUrl: string;
}) {
  const formattedStart = new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(input.startsAt);
  const title = escapeHtml(input.title);
  const firstName = escapeHtml(input.firstName);
  const hostName = escapeHtml(input.hostName);
  const formattedStartHtml = escapeHtml(formattedStart);
  const spaceUrl = escapeHtml(input.spaceUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.email],
      subject: `Starting in ${input.reminderLabel}: ${input.title}`,
      text: `Hi ${input.firstName},\n\nThe PAU Network space "${input.title}" hosted by ${input.hostName} starts in about ${input.reminderLabel}, at ${formattedStart} (WAT).\n\nView the space: ${input.spaceUrl}`,
      html: `<p>Hi ${firstName},</p><p>The PAU Network space <strong>${title}</strong>, hosted by ${hostName}, starts in about <strong>${input.reminderLabel}</strong>, at <strong>${formattedStartHtml} (WAT)</strong>.</p><p><a href="${spaceUrl}">View the space</a></p>`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend email request failed with HTTP ${response.status}`);
  }
}

async function sendDueSpaceReminders() {
  const now = new Date();
  const staleClaimBefore = new Date(now.getTime() - claimTimeoutMs);
  const participants = await prisma.spaceParticipant.findMany({
    where: {
      role: { not: "HOST" },
      OR: reminders.map((reminder) => ({
        [reminder.sentField]: null,
        space: {
          status: "SCHEDULED" as const,
          scheduledStartAt: { gt: now, lte: new Date(now.getTime() + reminder.leadTimeMs) },
        },
      })),
      space: {
        status: "SCHEDULED",
      },
    },
    select: {
      spaceId: true,
      userId: true,
      user: { select: { email: true, firstName: true } },
      space: {
        select: {
          title: true,
          scheduledStartAt: true,
          host: { select: { firstName: true, lastName: true } },
        },
      },
    },
    take: reminderPageSize,
  });

  for (const participant of participants) {
    for (const reminder of reminders) {
      if (participant.space.scheduledStartAt.getTime() - now.getTime() > reminder.leadTimeMs) continue;

      const claim = await prisma.spaceParticipant.updateMany({
        where: {
          spaceId: participant.spaceId,
          userId: participant.userId,
          [reminder.sentField]: null,
          OR: [{ [reminder.claimedField]: null }, { [reminder.claimedField]: { lt: staleClaimBefore } }],
        },
        data: { [reminder.claimedField]: now },
      });
      if (claim.count === 0) continue;

      try {
        await sendReminderEmail({
          email: participant.user.email,
          firstName: participant.user.firstName,
          title: participant.space.title,
          reminderLabel: reminder.label,
          startsAt: participant.space.scheduledStartAt,
          hostName: `${participant.space.host.firstName} ${participant.space.host.lastName}`,
          spaceUrl: `${env.FRONTEND_URL}/spaces/${participant.spaceId}`,
        });
        await prisma.spaceParticipant.updateMany({
          where: {
            spaceId: participant.spaceId,
            userId: participant.userId,
            [reminder.claimedField]: now,
          },
          data: { [reminder.sentField]: new Date(), [reminder.claimedField]: null },
        });
      } catch (error) {
        await prisma.spaceParticipant.updateMany({
          where: {
            spaceId: participant.spaceId,
            userId: participant.userId,
            [reminder.claimedField]: now,
          },
          data: { [reminder.claimedField]: null },
        });
        console.error(`Failed to send ${reminder.label} space reminder to participant ${participant.userId} for space ${participant.spaceId}:`, error);
      }
    }
  }
}

export function startSpaceReminderScheduler() {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.warn("Space reminder emails are disabled. Configure RESEND_API_KEY and EMAIL_FROM to enable delivery.");
    return;
  }

  let isRunning = false;
  const run = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await sendDueSpaceReminders();
    } catch (error) {
      console.error("Could not process scheduled space reminders:", error);
    } finally {
      isRunning = false;
    }
  };
  void run();
  setInterval(() => void run(), schedulerIntervalMs);
}

import { prisma } from "@/lib/prisma";

export async function writeNotificationLog(params: {
  channel: string;
  title: string;
  content: string;
  success: boolean;
  responseMessage: string;
  attempts: number;
}): Promise<void> {
  const now = new Date();
  await prisma.notificationLog.create({
    data: {
      channel: params.channel,
      title: params.title,
      content: params.content.slice(0, 4000),
      success: params.success ? 1 : 0,
      responseMessage: params.responseMessage.slice(0, 500),
      attempts: params.attempts,
      createdAt: now,
    },
  });
}

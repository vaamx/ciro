export class ChatSessionStats {
  total!: number;
  active!: number;
  completed!: number;
}

export class MessageStats {
  total!: number;
  userMessages!: number;
  aiMessages!: number;
}

export class RecentChat {
  id!: string;
  title!: string;
  lastMessage!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class DashboardResponseDto {
  chatStats!: ChatSessionStats;
  messageStats!: MessageStats;
  recentChats!: RecentChat[];
  totalResults!: number;
  page!: number;
  limit!: number;
} 
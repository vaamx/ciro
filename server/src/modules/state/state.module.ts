import { Module } from '@nestjs/common';
import { ConversationStateService } from '@services/state/conversation-state.service';
import { IConversationStateService } from '@services/state/i-conversation-state.service';

@Module({
  providers: [
    {
      provide: IConversationStateService,
      useClass: ConversationStateService,
    },
  ],
  exports: [IConversationStateService],
})
export class StateModule {} 
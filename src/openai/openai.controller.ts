import { Controller, Post, Body, Get, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OpenaiService } from './openai.service';
import { RedisService } from '../redis/redis.service';
import { CreateChatDto } from './dto/create-chat.dto';

@ApiTags('openai')
@Controller('openai')
export class OpenaiController {
  constructor(
    private readonly openaiService: OpenaiService,
    private readonly redisService: RedisService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Create a chat completion' })
  @ApiResponse({ status: 200, description: 'Chat response' })
  async createChat(@Body() createChatDto: CreateChatDto) {
    console.log('Received DTO:', createChatDto);
    console.log('Prompt:', createChatDto.prompt);
    const response = await this.openaiService.createChat(
      createChatDto.prompt,
      createChatDto.model,
      createChatDto.temperature,
      createChatDto.timestamp,
      createChatDto.userName,
      createChatDto.now,
      createChatDto.initTime,
    );
    return { response };
  }

  @Get('history/:userName')
  @ApiOperation({ summary: 'Get conversation history for a user' })
  @ApiResponse({ status: 200, description: 'Conversation history' })
  async getHistory(@Param('userName') userName: string) {
    const history = await this.openaiService.getConversationHistory(userName);
    return { userName, history };
  }

  @Delete('history/:userName')
  @ApiOperation({ summary: 'Clear conversation history for a user' })
  @ApiResponse({ status: 200, description: 'History cleared' })
  async clearHistory(@Param('userName') userName: string) {
    await this.openaiService.clearConversationHistory(userName);
    return { message: `Conversation history cleared for ${userName}` };
  }
}
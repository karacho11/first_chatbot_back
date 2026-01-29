import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  IsInt,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatDto {
  @ApiProperty({
    description: 'The prompt message to send to the AI',
    example: 'Hello, how are you?',
  })
  @IsString()
  prompt: string;

  @ApiProperty({
    description: 'The model to use for the chat',
    example: 'gpt-3.5-turbo',
    required: false,
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({
    description: 'Controls randomness in the response (0.0 to 2.0)',
    example: 0.7,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiProperty({
    description: 'Current timestamp from client',
    example: '2026-01-29T12:30:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  timestamp?: string;

  @ApiProperty({
    description: 'User name for caching',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiProperty({
    description: 'Current time when the request is made (ISO string)',
    example: '2026-01-29T12:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  now?: string;

  @ApiProperty({
    description: 'Initial time when the page was refreshed (ISO string)',
    example: '2026-01-29T12:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  initTime?: string;

  @ApiProperty({
    description: 'Enable RAG (retrieval augmented generation)',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  useRag?: boolean;

  @ApiProperty({
    description: 'Documents to retrieve from when RAG is enabled',
    example: [
      'NestJS는 Node.js 서버 사이드 애플리케이션을 위한 프레임워크입니다.',
      'Redis는 인메모리 데이터 저장소로 캐시와 세션에 활용됩니다.',
    ],
    required: false,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  documents?: string[];

  @ApiProperty({
    description: 'Top K documents to use for RAG context',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @ApiProperty({
    description: 'Embedding model for RAG retrieval',
    example: 'text-embedding-3-small',
    required: false,
  })
  @IsOptional()
  @IsString()
  embeddingModel?: string;
}
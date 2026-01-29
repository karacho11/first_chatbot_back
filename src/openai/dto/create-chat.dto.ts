import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
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
}
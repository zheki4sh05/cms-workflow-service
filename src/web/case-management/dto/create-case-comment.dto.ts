import { ApiProperty } from '@nestjs/swagger';

export class CreateCaseCommentDto {
  @ApiProperty({
    description: 'Comment text',
    example: 'Need additional verification from compliance team',
  })
  content!: string;
}

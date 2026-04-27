import { ApiProperty } from '@nestjs/swagger';

export class CreateCaseAttachmentDto {
  @ApiProperty({
    description: 'File identifier in object storage',
    example: 'f6f33a1f-2af2-433f-9a04-5695cd5e0ae9',
  })
  fileId!: string;

  @ApiProperty({
    description: 'Display file name',
    example: 'evidence.pdf',
  })
  name!: string;
}

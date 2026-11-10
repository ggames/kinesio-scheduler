import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StreamableFile } from '@nestjs/common';
import { AttachmentsService } from '../application/attachments.service';
import { CreateAttachmentDto } from '../application/dto/create-attachment.dto';
import { UploadAttachmentDto } from '../application/dto/upload-attachment.dto';

@ApiTags('Clinical Attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Post('multipart')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a clinical attachment (multipart)' })
  @ApiBody({
    description: 'Form-data con campos: patientId, appointmentId?, treatmentId? y file',
    schema: {
      type: 'object',
      properties: {
        patientId: { type: 'string', format: 'uuid' },
        appointmentId: { type: 'string', format: 'uuid' },
        treatmentId: { type: 'string', format: 'uuid' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['patientId', 'file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Adjunto creado' })
  async createMultipart(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body() dto: UploadAttachmentDto,
    @Req() req: any,
  ) {
    return this.service.createMultipart(file, dto, req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Upload a clinical attachment (base64 payload - legacy)' })
  @ApiBody({ type: CreateAttachmentDto })
  createLegacy(@Body() dto: CreateAttachmentDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'List attachments for a patient' })
  @ApiQuery({ name: 'patientId', required: true, type: String })
  findAll(@Query('patientId') patientId: string, @Req() req: any) {
    return this.service.findAll(patientId, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attachment metadata' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download attachment content (streaming)' })
  async download(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const found = await this.service.findOne(id, req.user);
    const stream = await this.service.getDownloadStream(
      found.storageKey ?? found.storagePath,
    );
    return new StreamableFile(stream, {
      type: found.mimeType,
      disposition: `attachment; filename="${found.fileName}"`,
    });
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Soft-delete (archive) an attachment' })
  archive(@Param('id') id: string, @Req() req: any) {
    return this.service.archive(id, req.user);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted attachment' })
  restore(@Param('id') id: string, @Req() req: any) {
    return this.service.restore(id, req.user);
  }
}

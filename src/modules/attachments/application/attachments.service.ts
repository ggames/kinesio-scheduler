import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import { Readable } from 'stream';
import { AuthorizationService } from '../../../core/auth/authorization.service';
import type { AuthenticatedUser } from '../../../core/auth/roles';
import { ClinicalAttachment } from '../domain/clinical-attachment.entity';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { LocalStorageProvider } from '../storage/local-storage.provider';
import { NoopAntivirusScanner } from '../security/antivirus-scanner.interface';
import { MAX_ATTACHMENT_SIZE_BYTES, ALLOWED_MIME_TYPES } from '../attachments.constants';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(ClinicalAttachment)
    private readonly repo: Repository<ClinicalAttachment>,
    private readonly authorizationService: AuthorizationService,
    private readonly storageProvider: LocalStorageProvider,
    private readonly antivirusScanner: NoopAntivirusScanner,
  ) {}

  async create(
    dto: CreateAttachmentDto,
    user: AuthenticatedUser,
  ): Promise<ClinicalAttachment> {
    if (!ALLOWED_MIME_TYPES.has(dto.mimeType)) {
      throw new BadRequestException(
        `Tipo MIME no permitido: ${dto.mimeType}. Tipos permitidos: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`,
      );
    }
    const buffer = Buffer.from(dto.contentBase64, 'base64');
    if (buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `Archivo demasiado grande: ${buffer.length} bytes. Máximo: ${MAX_ATTACHMENT_SIZE_BYTES} bytes (10 MB).`,
      );
    }
    return this.storeAttachment(buffer, dto.fileName, dto.mimeType, dto, user);
  }

  async createMultipart(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    dto: UploadAttachmentDto,
    user: AuthenticatedUser,
  ): Promise<ClinicalAttachment> {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Tipo MIME no permitido: ${file.mimetype}. Tipos permitidos: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`,
      );
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `Archivo demasiado grande: ${file.size} bytes. Máximo: ${MAX_ATTACHMENT_SIZE_BYTES} bytes (10 MB).`,
      );
    }

    return this.storeAttachment(
      file.buffer,
      file.originalname,
      file.mimetype,
      dto,
      user,
    );
  }

  private async storeAttachment(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    dto: CreateAttachmentDto | UploadAttachmentDto,
    user: AuthenticatedUser,
  ): Promise<ClinicalAttachment> {
    await this.authorizationService.assertCanReadClinicalRecord(
      user,
      dto.patientId,
    );

    const clinicId =
      (await this.authorizationService.getPatientClinicId(dto.patientId)) ??
      (await this.authorizationService.getDefaultClinicId());

    const checksum = createHash('sha256').update(buffer).digest('hex');

    const id = randomUUID();
    const safeName = basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `${id}-${safeName}`;

    const scanResult = await this.antivirusScanner.scan(buffer, fileName);
    if (!scanResult.isClean) {
      throw new BadRequestException(
        `Archivo rechazado por antivirus: ${scanResult.threat}`,
      );
    }

    const { storagePath } = await this.storageProvider.save(
      storageKey,
      buffer,
      mimeType,
    );

    const entity = this.repo.create({
      id,
      patientId: dto.patientId,
      clinicId,
      appointmentId: dto.appointmentId ?? null,
      treatmentId: dto.treatmentId ?? null,
      fileName,
      mimeType,
      sizeBytes: buffer.length,
      checksum,
      deletedAt: null,
      storageKey,
      storagePath,
      uploadedByUserId: user.userId,
    });
    return this.repo.save(entity);
  }

  async findAll(
    patientId: string,
    user: AuthenticatedUser,
  ): Promise<ClinicalAttachment[]> {
    await this.authorizationService.assertCanReadClinicalRecord(
      user,
      patientId,
    );
    return this.repo.find({
      where: { patientId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ClinicalAttachment> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) {
      throw new NotFoundException(`Adjunto ${id} no encontrado`);
    }
    await this.authorizationService.assertCanReadClinicalRecord(
      user,
      found.patientId,
    );
    return found;
  }

  async getDownloadStream(
    storageKeyOrPath: string,
  ): Promise<Readable> {
    if (existsSync(storageKeyOrPath)) {
      return createReadStream(storageKeyOrPath);
    }
    return this.storageProvider.getStream(storageKeyOrPath);
  }

  async download(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
    const found = await this.findOne(id, user);
    const content = await readFile(found.storagePath);
    return {
      fileName: found.fileName,
      mimeType: found.mimeType,
      contentBase64: content.toString('base64'),
    };
  }

  async archive(
    id: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const found = await this.findOne(id, user);
    if (found.deletedAt) {
      throw new BadRequestException(`Adjunto ${id} ya está archivado`);
    }
    found.deletedAt = new Date();
    await this.repo.save(found);
  }

  async restore(
    id: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) {
      throw new NotFoundException(`Adjunto ${id} no encontrado`);
    }
    await this.authorizationService.assertCanReadClinicalRecord(
      user,
      found.patientId,
    );
    if (!found.deletedAt) {
      throw new BadRequestException(`Adjunto ${id} no está archivado`);
    }
    found.deletedAt = null;
    await this.repo.save(found);
  }
}

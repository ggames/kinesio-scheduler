// scripts/generate_agenda_modules.js
const fs = require('fs');
const path = require('path');

const srcRoot = path.join('src', 'modules', 'agenda');
const domainDir = path.join(srcRoot, 'domain');
const entities = fs.readdirSync(domainDir).filter(f => f.endsWith('.entity.ts'));

function pascalToKebab(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function createModule(entityFile) {
  const baseName = entityFile.replace('.entity.ts', '');
  const parts = baseName.split('-');
  const className = parts.map(capitalize).join(''); // e.g. Clinic
  const moduleName = pascalToKebab(className); // clinic
  const moduleDir = path.join(srcRoot, moduleName);
  const domainPath = path.join(moduleDir, 'domain');
  const appPath = path.join(moduleDir, 'application');
  const infraPath = path.join(moduleDir, 'infrastructure');
  const servicesPath = path.join(appPath, 'services');
  const dtoPath = path.join(appPath, 'dto');
  const persistencePath = path.join(infraPath, 'persistence');
  // create directories
  [domainPath, servicesPath, dtoPath, infraPath, persistencePath].forEach(p => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
  // move entity file
  const oldEntityPath = path.join(domainDir, entityFile);
  const newEntityPath = path.join(domainPath, entityFile);
  fs.copyFileSync(oldEntityPath, newEntityPath);
  fs.unlinkSync(oldEntityPath);
  // DTO placeholder
  const dtoContent = `import { IsString, IsOptional, IsUUID } from 'class-validator';\n\nexport class Create${className}Dto {\n  @IsUUID()\n  @IsOptional()\n  id?: string;\n\n  @IsString()\n  name: string;\n}`;
  fs.writeFileSync(path.join(dtoPath, `create-${moduleName}.dto.ts`), dtoContent);
  // Service skeleton
  const serviceContent = `import { Injectable, NotFoundException } from '@nestjs/common';\nimport { InjectRepository } from '@nestjs/typeorm';\nimport { Repository } from 'typeorm';\nimport { ${className} } from '../domain/${entityFile}';\nimport { Create${className}Dto } from './dto/create-${moduleName}.dto';\n\n@Injectable()\nexport class ${className}Service {\n  constructor(@InjectRepository(${className}) private readonly repo: Repository<${className}>) {}\n  async findAll(): Promise<${className}[]> { return this.repo.find(); }\n  async findOne(id: string): Promise<${className}> {\n    const entity = await this.repo.findOne({ where: { id } });\n    if (!entity) throw new NotFoundException('${className} not found');\n    return entity;\n  }\n  async create(dto: Create${className}Dto): Promise<${className}> {\n    const entity = this.repo.create(dto as any);\n    return this.repo.save(entity);\n  }\n  async update(id: string, dto: Partial<Create${className}Dto>): Promise<${className}> {\n    await this.repo.update(id, dto as any);\n    return this.findOne(id);\n  }\n  async remove(id: string): Promise<void> { await this.repo.delete(id); }\n}\n`;
  fs.writeFileSync(path.join(servicesPath, `${moduleName}.service.ts`), serviceContent);
  // Controller exposing '/clinic' etc.
  const controllerContent = `import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';\nimport { ${className}Service } from '../services/${moduleName}.service';\nimport { Create${className}Dto } from '../dto/create-${moduleName}.dto';\n\n@Controller('${moduleName}')\nexport class ${className}Controller {\n  constructor(private readonly service: ${className}Service) {}\n  @Get() findAll() { return this.service.findAll(); }\n  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }\n  @Post() create(@Body() dto: Create${className}Dto) { return this.service.create(dto); }\n  @Put(':id') update(@Param('id') id: string, @Body() dto: Partial<Create${className}Dto>) { return this.service.update(id, dto); }\n  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }\n}\n`;
  fs.writeFileSync(path.join(infraPath, `${moduleName}.controller.ts`), controllerContent);
  // Repository placeholder (TypeORM will use entity directly)
  const repoContent = `import { EntityRepository, Repository } from 'typeorm';\nimport { ${className} } from '../../domain/${entityFile}';\n\n@EntityRepository(${className})\nexport class ${className}Repository extends Repository<${className}> {}\n`;
  fs.writeFileSync(path.join(persistencePath, `${moduleName}.repository.ts`), repoContent);
  console.log(`Generated module for ${className}`);
}

entities.forEach(e => createModule(e));

// Update agenda.module.ts to import generated modules
const agendaModulePath = path.join(srcRoot, 'agenda.module.ts');
let agendaContent = fs.readFileSync(agendaModulePath, 'utf8');
// Remove old domain imports
agendaContent = agendaContent.replace(/import {[^}]*} from '\.\/domain\/[^']*';\n/g, '');
const importLines = entities.map(e => {
  const className = e.replace('.entity.ts','').split('-').map(capitalize).join('');
  const moduleName = pascalToKebab(className);
  return `import { ${className}Controller } from './${moduleName}/${moduleName}.controller';\nimport { ${className}Service } from './${moduleName}/application/services/${moduleName}.service';`;
}).join('\n');
agendaContent = `${importLines}\n${agendaContent}`;
// Insert controllers and providers
agendaContent = agendaContent.replace(/controllers: \[/, `controllers: [\n    ${entities.map(e => e.replace('.entity.ts','').split('-').map(capitalize).join('')+'Controller').join(',\n    ')},`);
agendaContent = agendaContent.replace(/providers: \[/, `providers: [\n    ${entities.map(e => e.replace('.entity.ts','').split('-').map(capitalize).join('')+'Service').join(',\n    ')},`);
fs.writeFileSync(agendaModulePath, agendaContent);
console.log('Agenda module updated');

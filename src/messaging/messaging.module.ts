import { Module } from '@nestjs/common';
import { MessagingGateway } from './messaging.gateway';
import { UserModule } from 'src/user/user.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [MessagingGateway],
})
export class MessagingModule {}

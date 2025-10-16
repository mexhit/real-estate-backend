import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PropertiesController } from './properties/properties.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // makes .env variables available everywhere
    }),
  ],
  controllers: [AppController, PropertiesController],
  providers: [AppService],
})
export class AppModule {}

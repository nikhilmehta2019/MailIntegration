import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import configValidation from './shared/config.validation';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GmailModule } from './gmail/gmail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: configValidation,
    }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      synchronize: process.env.NODE_ENV === 'development' ? true : false,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrationsRun: true,
    }),
    GmailModule,
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}

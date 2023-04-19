import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class GoogleUser {
  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  access_token: string;

  @Column()
  refresh_token: string;

  @Column()
  userId: string;

  @Column()
  scope: string;

  @Column()
  token_type: string;

  @Column()
  expiry_date: string;
}

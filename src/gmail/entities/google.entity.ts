import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class GoogleUser {
  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  access_token: string;

  @Column()
  refresh_token: string;

  @Column({
    type: 'int',
  })
  userId: number;

  @Column()
  scope: string;

  @Column()
  token_type: string;

  @Column()
  expiry_date: string;

  @Column()
  email: string;

  @Column()
  updatedAt: string;

  @Column({
    type: 'int',
  })
  updatedBy: number;
}

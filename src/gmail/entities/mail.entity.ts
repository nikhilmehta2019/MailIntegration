import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Mail {
  @PrimaryColumn()
  messageId: string;

  @Column()
  userId: string;

  @Column()
  isRelatable: boolean;
}

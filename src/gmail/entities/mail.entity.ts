import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Mail {
  @PrimaryColumn()
  messageId: string;

  @Column({
    type: 'int',
  })
  userId: number;

  @Column()
  isRelatable: boolean;

  @Column()
  subject: string;

  @Column()
  date: string;

  @Column()
  from: string;
}

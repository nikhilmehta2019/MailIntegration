import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Mail {
  @PrimaryGeneratedColumn({
    type: 'int',
  })
  SeqNo: number;

  @Column({
   
  })
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
  @Column()
  updatedAt: Date;

  @Column({
    type: 'int',
  })
  updatedBy: number;
}

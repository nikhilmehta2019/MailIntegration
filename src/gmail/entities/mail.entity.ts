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
}

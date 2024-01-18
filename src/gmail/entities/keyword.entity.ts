import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class EmailKeywords {
  @PrimaryGeneratedColumn()
  SeqNo: number;

  @Column({ type: 'longtext', nullable: false })
  Keyword: string;

  @Column({ type: 'tinyint', width: 1, nullable: false, default: 0 })
  FrzInd: number;
}

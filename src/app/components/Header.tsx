import Image from 'next/image';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <Image
            src="/icon.png"
            alt="image-gen.jpc.io logo"
            width={40}
            height={40}
            className={styles.icon}
          />
          <h1 className={styles.title}>image-gen.jpc.io</h1>
        </div>
      </div>
    </header>
  );
}

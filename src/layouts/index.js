import styles from './index.css';

function BasicLayout(props) {
  return (
    <div className={styles.normal}>
      <h1 className={styles.title}>开始爬虫之旅, lab</h1>
      {props.children}
    </div>
  );
}

export default BasicLayout;

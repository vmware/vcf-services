import React from 'react';

export default class Home extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const reactVersion = require('./package.json').dependencies['react'];

    const styles = {
      container: {
        fontFamily: 'Arial, sans-serif',
        padding: '20px',
        backgroundColor: '#f0f2f5',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        maxWidth: '600px',
        margin: '20px auto',
        border: '1px solid #ddd'
      },
      header: {
        color: '#1a1a1a',
        textAlign: 'center',
        borderBottom: '2px solid #e0e0e0',
        paddingBottom: '15px',
        marginBottom: '20px',
        fontSize: '24px'
      },
      content: {
        color: '#333',
      },
      paragraph: {
        lineHeight: '1.6',
        fontSize: '16px',
        marginBottom: '15px'
      },
      box: {
        backgroundColor: '#ffffff',
        border: '1px solid #e0e0e0',
        padding: '15px',
        borderRadius: '6px',
        margin: '20px 0',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
      },
      code: {
        fontFamily: 'monospace',
        backgroundColor: '#e8e8e8',
        padding: '2px 4px',
        borderRadius: '3px',
      },
      strong: {
        color: '#0056b3'
      }
    };

    return (
      <div style={styles.container}>
        <h1 style={styles.header}>React Application as a Web Component</h1>
        <div style={styles.content}>
          <p style={styles.paragraph}>
            This user interface is built using <strong style={styles.strong}>React</strong>.
          </p>
          <div style={styles.box}>
            <p><strong>React Version:</strong> <code style={styles.code}>{reactVersion}</code></p>
          </div>
          <p style={styles.paragraph}>
            The entire React application is encapsulated and delivered as a <strong style={styles.strong}>Web Component</strong>.
            This is a standards-based way to create custom, reusable HTML elements that can be used with any JavaScript library or framework, or even with no framework at all.
          </p>
          <p style={styles.paragraph}>
            This approach promotes <strong style={styles.strong}>interoperability</strong> and allows different parts of a larger application to be built with different technologies without conflicts.
          </p>
        </div>
      </div>
    );
  }
}

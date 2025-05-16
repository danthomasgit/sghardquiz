"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function Home() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [showHostModal, setShowHostModal] = useState(false);
  const [hostPassword, setHostPassword] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && subject.trim()) {
      router.push(`/play?name=${encodeURIComponent(name)}&subject=${encodeURIComponent(subject)}`);
    }
  };

  const handleHostAccess = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement proper password validation
    if (hostPassword === "admin") {
      router.push("/host");
    } else {
      alert("Invalid password");
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome to the Trivia Game!</h1>
          <p className={styles.subtitle}>Test your knowledge and compete with your team</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              Your Name
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className={styles.input}
                placeholder="Enter your name"
              />
            </label>
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              Specialist Subject
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
                className={styles.input}
                placeholder="e.g. Science, Movies, etc."
              />
            </label>
          </div>
          <button type="submit" className={styles.button}>
            Join Game
          </button>
        </form>
      </main>

      <button 
        className={styles.hostButton}
        onClick={() => setShowHostModal(true)}
        aria-label="Host Access"
      >
        Host
      </button>

      {showHostModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Host Access</h2>
            <form onSubmit={handleHostAccess}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  Password
                  <input
                    type="password"
                    value={hostPassword}
                    onChange={e => setHostPassword(e.target.value)}
                    required
                    className={styles.input}
                    placeholder="Enter host password"
                  />
                </label>
              </div>
              <div className={styles.modalButtons}>
                <button type="submit" className={styles.button}>
                  Enter
                </button>
                <button 
                  type="button" 
                  className={styles.secondaryButton}
                  onClick={() => setShowHostModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { HouseRules } from '../../game/types';
import type { Theme } from '../../theme';
import type { Preferences } from '../../lib/preferences';
import { ACHIEVEMENTS, loadProgression } from '../../lib/progression';
import { CardFace, Dialog, Icon, Toggle } from './Primitives';

export function ComfortPanel({ preferences, onChange, theme, onThemeChange, sound, onSound, onClose }: {
  preferences: Preferences; onChange: (value: Preferences) => void; theme: Theme; onThemeChange: (theme: Theme) => void;
  sound: boolean; onSound: () => void; onClose: () => void;
}) {
  return <Dialog title="Make yourself comfortable" eyebrow="YOUR TABLE, YOUR WAY" onClose={onClose}>
    <p className="panel-intro">A few little things to make playing feel just right. Your choices are remembered on this device.</p>
    <div className="setting-block"><strong>Computer player pace</strong><p>There is never a time limit on your turn.</p><div className="segmented">{(['relaxed', 'regular', 'quick'] as const).map(pace => <button key={pace} aria-pressed={preferences.pace === pace} onClick={() => onChange({ ...preferences, pace })}>{pace === 'relaxed' ? 'Relaxed' : pace === 'regular' ? 'Regular' : 'Quick'}</button>)}</div></div>
    <Toggle label="Larger cards" description="Extra room for ranks, suits, and your fingertips." value={preferences.largeCards} onChange={largeCards => onChange({ ...preferences, largeCards })} />
    <Toggle label="A helping hand" description="Show useful advice as you play." value={preferences.coaching} onChange={coaching => onChange({ ...preferences, coaching })} />
    <Toggle label="Gentle motion" description="Keep animations still and simple." value={preferences.reducedMotion} onChange={reducedMotion => onChange({ ...preferences, reducedMotion })} />
    <Toggle label="Game sounds" description="The soft shuffle and satisfying slide of cards." value={sound} onChange={onSound} />
    <div className="setting-block"><strong>Table colour</strong><div className="theme-options"><button aria-pressed={theme === 'classic'} onClick={() => onThemeChange('classic')}><span className="theme-swatch green" /> Garden green</button><button aria-pressed={theme === 'casino'} onClick={() => onThemeChange('casino')}><span className="theme-swatch blue" /> Midnight blue</button></div></div>
    <button className="primary-button full" onClick={onClose}>All set <Icon name="check" /></button>
  </Dialog>;
}

export function LearnPanel({ onClose, onPractice, rules }: { onClose: () => void; onPractice?: () => void; rules: HouseRules }) {
  const [step, setStep] = useState(0);
  const lessons = [
    { title: 'A little lower. A little closer.', body: 'Your goal is to play all your cards. On your turn, play a card equal to or lower than the top card. Aces are low. You can play matching ranks together.', detail: 'A 5 can go on a 7. Select your card, then press Play cards.', ranks: ['7', '5'] as const },
    { title: 'Save a little magic.', body: rules.tenBurns ? 'A 10 can go on anything. It burns the whole pile, and you play again. When four matching ranks sit on top, they swipe the pile away too.' : 'With 10 burns switched off, a 10 plays between a 9 and a Jack. Play equal or lower, just like any other card.', detail: rules.fourOfAKindSwipes ? 'Complete four matching ranks on top to clear the pile and go again.' : 'Four-of-a-kind swipes are switched off at this table.', ranks: ['10', '10'] as const },
    { title: 'Your table has a few surprises.', body: 'Your four face-up cards can be played just like your hand cards. Play a face-up card to uncover the face-down card beneath it. On a later turn, you may choose to flip that card.', detail: 'Once revealed, a face-down card must be played. Add matching cards if you like, then confirm.', ranks: ['K', 'A'] as const },
    { title: 'Every hand has a way forward.', body: 'If none of your cards are equal or lower, play a higher rank and pick up the pile. Pile cards matching the rank you played stay on the table. A face-down card that is too high works the same way.', detail: 'You can also choose Take pile. You collect the entire pile and keep your turn.', ranks: ['3', 'Q'] as const },
    { title: 'The lowest score wins.', body: 'The first person to empty all their cards wins the round and scores zero. Everyone else adds the points on their remaining cards. The game ends when someone reaches the table’s score limit.', detail: 'A = 1 · 2–9 = face value · J, Q, K = 10 · 10 = 20 points.', ranks: ['A', 'K'] as const },
  ];
  const lesson = lessons[step];
  return <Dialog title="Let’s learn Swipe" eyebrow={`A FRIENDLY GUIDE · ${step + 1} OF ${lessons.length}`} onClose={onClose}>
    <div className="lesson-cards"><CardFace card={{ id: 'example-1', rank: lesson.ranks[0], suit: '♠' }} /><Icon name="arrow" size={28} /><CardFace card={{ id: 'example-2', rank: lesson.ranks[1], suit: '♥' }} /></div>
    <h3 className="lesson-title">{lesson.title}</h3><p className="panel-intro">{lesson.body}</p><div className="lesson-note"><Icon name="spark" /><p>{lesson.detail}</p></div>
    {rules.twosReset && <p className="muted">At this table, 2s also reset the pile: play a 2 on anything, then the next player may play any rank.</p>}
    <div className="lesson-progress" aria-label={`Lesson ${step + 1} of ${lessons.length}`}>{lessons.map((_, i) => <span className={i === step ? 'active' : ''} key={i} />)}</div>
    <div className="dialog-actions">{step > 0 && <button className="secondary-button" onClick={() => setStep(step - 1)}>Back</button>}{step < lessons.length - 1 ? <button className="primary-button" onClick={() => setStep(step + 1)}>Next <Icon name="arrow" /></button> : <button className="primary-button" onClick={onPractice ?? onClose}>{onPractice ? 'Try a practice game' : 'Back to the table'}<Icon name="play" /></button>}</div>
  </Dialog>;
}

export function ProgressPanel({ onClose }: { onClose: () => void }) {
  const progress = loadProgression();
  return <Dialog title="Your little collection" eyebrow="THE JOY IS IN THE PLAYING" onClose={onClose} wide>
    <div className="progress-stats"><div><b>{progress.gamesWon}</b><span>Games won</span></div><div><b>{progress.roundsWon}</b><span>Rounds won</span></div><div><b>{progress.totalSwipes}</b><span>Perfect swipes</span></div></div>
    <p className="panel-intro">Small victories, lovely memories. Your milestones are saved on this device.</p>
    <div className="achievement-grid">{Object.values(ACHIEVEMENTS).map(achievement => {
      const earned = progress.achievements.some(item => item.id === achievement.id);
      return <div key={achievement.id} className={`achievement ${earned ? 'earned' : ''}`}><span className="achievement-icon"><Icon name={earned ? 'trophy' : 'spark'} size={26} /></span><div><strong>{achievement.title}</strong><p>{achievement.description}</p><small>{earned ? 'Earned ✓' : 'Something to look forward to'}</small></div></div>;
    })}</div>
  </Dialog>;
}

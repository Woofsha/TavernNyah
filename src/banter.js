// Event-triggered banter system (90+ lines w/ cooldowns), new-hire multi-beat comedy skits,
// skippable ~40s story intro controller, and dual-voice offline summary formatter.
// Pure ES module (browser + headless Node safe).

export class BanterSystem {
  constructor(dialogueData) {
    this.data = dialogueData || { intro: [], banter: [], hireScenes: {}, offlineTemplates: [] };
    this.lineCooldowns = new Map(); // lineId -> remainingSec
    this.globalCooldown = 4.0;
    this.idleTimer = 8.0;
    this.activeBubbleQueue = []; // queued beats: { speaker, text, duration, emote }
    this.currentBeat = null;     // { speaker, text, remaining, total, emote }
    this.history = [];           // recent banter log for UI toast / chat ticker

    // Story intro state
    this.introActive = false;
    this.introIndex = 0;
    this.introBeatTimer = 0;
    this.introCharProgress = 0;
  }

  startIntro() {
    if (!this.data.intro || this.data.intro.length === 0) {
      this.introActive = false;
      return;
    }
    this.introActive = true;
    this.introIndex = 0;
    this.introBeatTimer = 0;
    this.introCharProgress = 0;
  }

  skipIntro() {
    this.introActive = false;
  }

  advanceIntroBeat() {
    if (!this.introActive) return false;
    const beat = this.data.intro[this.introIndex];
    if (beat && this.introCharProgress < beat.text.length) {
      // First click reveals full line if still typing
      this.introCharProgress = beat.text.length;
      return true;
    }
    this.introIndex += 1;
    this.introBeatTimer = 0;
    this.introCharProgress = 0;
    if (this.introIndex >= this.data.intro.length) {
      this.introActive = false;
      return false;
    }
    return true;
  }

  updateIntro(dt, onBlip) {
    if (!this.introActive) return;
    const beat = this.data.intro[this.introIndex];
    if (!beat) {
      this.introActive = false;
      return;
    }
    const prevChars = Math.floor(this.introCharProgress);
    const charsPerSec = beat.text === '...' ? 4 : 34;
    this.introCharProgress = Math.min(beat.text.length, this.introCharProgress + dt * charsPerSec);
    const nowChars = Math.floor(this.introCharProgress);
    if (nowChars > prevChars && beat.text !== '...' && nowChars % 2 === 1 && onBlip) {
      onBlip(beat.speaker || 'narrator');
    }

    this.introBeatTimer += dt;
    if (this.introBeatTimer >= (beat.durationSec || 4.0)) {
      this.introIndex += 1;
      this.introBeatTimer = 0;
      this.introCharProgress = 0;
      if (this.introIndex >= this.data.intro.length) {
        this.introActive = false;
      }
    }
  }

  getCurrentIntroBeat() {
    if (!this.introActive) return null;
    const beat = this.data.intro[this.introIndex];
    if (!beat) return null;
    const totalSec = this.data.intro.reduce((acc, b) => acc + (b.durationSec || 4), 0);
    const elapsedPrior = this.data.intro
      .slice(0, this.introIndex)
      .reduce((acc, b) => acc + (b.durationSec || 4), 0);
    return {
      ...beat,
      visibleText: beat.text.slice(0, Math.floor(this.introCharProgress)),
      index: this.introIndex,
      totalBeats: this.data.intro.length,
      elapsedSec: elapsedPrior + this.introBeatTimer,
      totalSec,
    };
  }

  update(dt, sim, onBlip) {
    // Tick cooldowns
    for (const [id, rem] of this.lineCooldowns.entries()) {
      if (rem - dt <= 0) this.lineCooldowns.delete(id);
      else this.lineCooldowns.set(id, rem - dt);
    }
    if (this.globalCooldown > 0) this.globalCooldown = Math.max(0, this.globalCooldown - dt);

    // Advance active speech beat
    if (this.currentBeat) {
      this.currentBeat.remaining -= dt;
      if (this.currentBeat.remaining <= 0) {
        this.currentBeat = null;
      }
    }

    if (!this.currentBeat && this.activeBubbleQueue.length > 0) {
      this.currentBeat = this.activeBubbleQueue.shift();
      this.history.unshift({
        speaker: this.currentBeat.speaker,
        text: this.currentBeat.text,
        time: sim ? sim.totalTimeSec : 0,
      });
      if (this.history.length > 18) this.history.length = 18;
      if (onBlip) onBlip(this.currentBeat.speaker);
    }

    // Periodic idle banter trigger
    this.idleTimer -= dt;
    if (this.idleTimer <= 0) {
      this.idleTimer = 14 + ((sim ? sim.rngSeedCounter : 3) % 9);
      if (!this.currentBeat && this.activeBubbleQueue.length === 0) {
        if (sim && sim.isMusicianPerforming) {
          this.trigger('music', sim);
        } else {
          this.trigger('idle', sim);
        }
      }
    }
  }

  trigger(triggerType, sim, force = false) {
    if (!force && (this.globalCooldown > 0 || this.activeBubbleQueue.length > 2)) {
      return false;
    }
    const candidates = (this.data.banter || []).filter(
      (b) => b.trigger === triggerType && !this.lineCooldowns.has(b.id)
    );
    if (candidates.length === 0) return false;

    const idx = sim ? Math.abs(sim.nextSeed()) % candidates.length : Math.floor(Math.random() * candidates.length);
    const chosen = candidates[idx];
    this.lineCooldowns.set(chosen.id, chosen.cooldownSec || 30);
    this.globalCooldown = force ? 1.5 : 6.5;

    this.activeBubbleQueue.push({
      speaker: chosen.speaker,
      text: chosen.text,
      duration: 4.2,
      remaining: 4.2,
      emote: triggerType === 'complaint' ? 'emote_anger' : triggerType === 'big_tip' ? 'emote_heart' : null,
    });

    if (chosen.replySpeaker && chosen.replyText) {
      this.activeBubbleQueue.push({
        speaker: chosen.replySpeaker,
        text: chosen.replyText,
        duration: 4.2,
        remaining: 4.2,
        emote: chosen.replySpeaker === 'fifi' ? 'emote_exclaim' : 'emote_sparkle',
      });
    }
    return true;
  }

  triggerHireScene(staffId) {
    const scene = this.data.hireScenes?.[staffId];
    if (!scene || !Array.isArray(scene)) return false;
    // Clear minor idle items so the new-hire comedy scene plays right away!
    this.activeBubbleQueue = [];
    this.currentBeat = null;
    for (const beat of scene) {
      this.activeBubbleQueue.push({
        speaker: beat.speaker,
        text: beat.text,
        duration: 4.0,
        remaining: 4.0,
        emote: beat.emote || 'emote_exclaim',
      });
    }
    this.globalCooldown = 10.0;
    return true;
  }

  pushCustomLine(speaker, text, emote = 'emote_sparkle') {
    this.activeBubbleQueue.push({
      speaker,
      text,
      duration: 4.0,
      remaining: 4.0,
      emote,
    });
  }

  formatOfflineSummary(minutesAway, goldEarned, customersServed) {
    const templates = this.data.offlineTemplates || [];
    let chosen = templates[0] || {
      nyahText: 'Hmph! You vanished for {minutes} minutes, so I ran the whole tavern and made {gold} gold!',
      fifiText: 'Welcome back! We served {customers} guests without burning anything down!',
    };
    for (const tpl of templates) {
      if (minutesAway >= (tpl.minMinutes || 0)) {
        chosen = tpl;
      }
    }
    const replaceTokens = (s) =>
      String(s || '')
        .replace(/\{minutes\}/g, String(Math.max(1, Math.round(minutesAway))))
        .replace(/\{gold\}/g, String(Math.round(goldEarned)))
        .replace(/\{customers\}/g, String(Math.max(1, Math.round(customersServed))));

    return {
      minutes: Math.max(1, Math.round(minutesAway)),
      gold: Math.round(goldEarned),
      customers: Math.max(1, Math.round(customersServed)),
      nyahText: replaceTokens(chosen.nyahText),
      fifiText: replaceTokens(chosen.fifiText),
    };
  }
}

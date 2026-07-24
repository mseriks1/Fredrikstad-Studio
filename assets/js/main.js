(() => {
  const body = document.body;
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const navLinks = [...document.querySelectorAll('.main-nav a')];
  const revealItems = document.querySelectorAll('[data-reveal]');
  const serviceRows = document.querySelectorAll('[data-service]');
  const contactForms = [...document.querySelectorAll('[data-contact-form]')];
  const toast = document.querySelector('[data-toast]');
  const glow = document.querySelector('.cursor-glow');
  const songSearch = document.querySelector('[data-song-search]');
  const songItems = [...document.querySelectorAll('[data-song-title]')];
  const songCount = document.querySelector('[data-song-count]');
  const songEmpty = document.querySelector('[data-song-empty]');
  const MAX_AUDIO_FILE_BYTES = 10 * 1024 * 1024;

  document.querySelectorAll('[data-delay]').forEach((item) => {
    item.style.setProperty('--delay', `${item.dataset.delay}ms`);
  });

  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  menuButton?.addEventListener('click', () => {
    const open = body.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Lukk meny' : 'Åpne meny');
  });

  nav?.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      body.classList.remove('menu-open');
      menuButton?.setAttribute('aria-expanded', 'false');
      menuButton?.setAttribute('aria-label', 'Åpne meny');
    }
  });

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    revealItems.forEach((item) => revealObserver.observe(item));

    const sections = [...document.querySelectorAll('main section[id]')];
    const activeObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.id;
      navLinks.filter((link) => link.getAttribute('href')?.startsWith('#')).forEach((link) => {
        const target = link.getAttribute('href');
        link.classList.toggle('is-active', target === `#${id}`);
      });
    }, { rootMargin: '-30% 0px -58%', threshold: [0.05, 0.2, 0.5] });
    sections.forEach((section) => activeObserver.observe(section));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  serviceRows.forEach((row) => {
    const button = row.querySelector('button');
    const arrow = row.querySelector('.service-arrow');
    button?.addEventListener('click', () => {
      const willOpen = !row.classList.contains('is-open');
      serviceRows.forEach((other) => {
        other.classList.remove('is-open');
        other.querySelector('button')?.setAttribute('aria-expanded', 'false');
        const otherArrow = other.querySelector('.service-arrow');
        if (otherArrow) otherArrow.textContent = '+';
      });
      if (willOpen) {
        row.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        if (arrow) arrow.textContent = '−';
      }
    });
  });

  let toastTimer;
  const showToast = (title, message, state = 'success') => {
    if (!toast) return;
    const icon = toast.querySelector('[data-toast-icon]');
    const titleElement = toast.querySelector('[data-toast-title]');
    const messageElement = toast.querySelector('[data-toast-message]');
    if (icon) icon.textContent = state === 'error' ? '!' : '✓';
    if (titleElement) titleElement.textContent = title;
    if (messageElement) messageElement.textContent = message;
    toast.classList.toggle('is-error', state === 'error');
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 6000);
  };

  const getContactEndpoint = () => {
    const endpoint = window.FREDRIKSTAD_STUDIO_CONFIG?.contactFormEndpoint?.trim() || '';
    const isConfigured = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint);
    return isConfigured ? endpoint : '';
  };

  const formatFileSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;

  const validateAudioFile = (fileInput, feedback) => {
    const file = fileInput?.files?.[0];
    fileInput?.setCustomValidity('');
    feedback?.classList.remove('is-error', 'is-selected');

    if (!file) {
      if (feedback) feedback.textContent = 'Filen legges ved e-posten til Fredrikstad Studio.';
      return null;
    }

    if (!file.name.toLocaleLowerCase('nb-NO').endsWith('.mp3')) {
      fileInput.setCustomValidity('Velg en MP3-fil.');
      if (feedback) {
        feedback.textContent = 'Velg en fil som slutter på .mp3.';
        feedback.classList.add('is-error');
      }
      return null;
    }

    if (file.size <= 0) {
      fileInput.setCustomValidity('MP3-filen er tom.');
      if (feedback) {
        feedback.textContent = 'MP3-filen er tom. Velg en annen fil.';
        feedback.classList.add('is-error');
      }
      return null;
    }

    if (file.size > MAX_AUDIO_FILE_BYTES) {
      fileInput.setCustomValidity('MP3-filen kan være maks 10 MB.');
      if (feedback) {
        feedback.textContent = `${file.name} er ${formatFileSize(file.size)}. Maks størrelse er 10 MB.`;
        feedback.classList.add('is-error');
      }
      return null;
    }

    if (feedback) {
      feedback.textContent = `${file.name} · ${formatFileSize(file.size)} · klar til å sendes`;
      feedback.classList.add('is-selected');
    }
    return file;
  };

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Filen kunne ikke leses.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      if (commaIndex < 0) {
        reject(new Error('Filen kunne ikke klargjøres.'));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.readAsDataURL(file);
  });

  contactForms.forEach((contactForm) => {
    const submitButton = contactForm.querySelector('.form-submit');
    const buttonText = submitButton?.querySelector('span');
    const formNote = contactForm.querySelector('[data-form-note]');
    const fileInput = contactForm.querySelector('[data-audio-file]');
    const fileFeedback = contactForm.querySelector('[data-file-feedback]');
    const originalButtonText = buttonText?.textContent || 'Send forespørsel';

    fileInput?.addEventListener('change', () => {
      validateAudioFile(fileInput, fileFeedback);
    });

    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const audioFile = validateAudioFile(fileInput, fileFeedback);
      if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
      }

      const endpoint = getContactEndpoint();
      if (!endpoint) {
        if (formNote) {
          formNote.textContent = 'Kontaktskjemaet må aktiveres før publisering. Kontakt: fredrikstadstudio@gmail.com';
          formNote.classList.add('is-error');
        }
        showToast('Skjemaet er ikke aktivert', 'Send e-post til fredrikstadstudio@gmail.com.', 'error');
        return;
      }

      const formData = new FormData(contactForm);
      formData.delete('audioFile');
      formData.set('page', window.location.href);
      formData.set('submittedAt', new Date().toISOString());

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute('aria-busy', 'true');
      }
      if (buttonText) buttonText.textContent = audioFile ? 'Laster opp…' : 'Sender…';
      if (formNote) {
        formNote.textContent = audioFile ? 'Laster opp MP3 og sender forespørselen…' : 'Sender forespørselen…';
        formNote.classList.remove('is-error', 'is-success');
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), audioFile ? 90000 : 20000);

      try {
        if (audioFile) {
          const base64 = await readFileAsBase64(audioFile);
          formData.set('audioFileName', audioFile.name);
          formData.set('audioFileType', audioFile.type || 'audio/mpeg');
          formData.set('audioFileSize', String(audioFile.size));
          formData.set('audioFileBase64', base64);
          if (buttonText) buttonText.textContent = 'Sender…';
        }

        await fetch(endpoint, {
          method: 'POST',
          mode: 'no-cors',
          body: new URLSearchParams(formData),
          signal: controller.signal
        });

        contactForm.reset();
        validateAudioFile(fileInput, fileFeedback);
        if (formNote) {
          formNote.textContent = audioFile
            ? 'Takk! Forespørselen og MP3-filen er sendt til Fredrikstad Studio.'
            : 'Takk! Forespørselen er sendt til Fredrikstad Studio.';
          formNote.classList.add('is-success');
        }
        showToast(
          'Takk!',
          audioFile ? 'Forespørselen og MP3-filen er sendt.' : 'Forespørselen er sendt til Fredrikstad Studio.'
        );
      } catch (error) {
        const timedOut = error?.name === 'AbortError';
        const fileReadError = !timedOut && /fil/i.test(error?.message || '');
        if (formNote) {
          formNote.textContent = timedOut
            ? 'Innsendingen tok for lang tid. Prøv igjen med en mindre fil eller send e-post til fredrikstadstudio@gmail.com.'
            : fileReadError
              ? 'MP3-filen kunne ikke leses. Velg filen på nytt eller send e-post til fredrikstadstudio@gmail.com.'
              : 'Forespørselen kunne ikke sendes. Prøv igjen eller send e-post til fredrikstadstudio@gmail.com.';
          formNote.classList.add('is-error');
        }
        showToast(
          'Kunne ikke sende',
          timedOut ? 'Prøv igjen med en mindre fil.' : fileReadError ? 'Velg MP3-filen på nytt.' : 'Kontroller nettet og prøv igjen.',
          'error'
        );
      } finally {
        window.clearTimeout(timeout);
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.removeAttribute('aria-busy');
        }
        if (buttonText) buttonText.textContent = originalButtonText;
      }
    });
  });

  if (songSearch && songItems.length) {
    const normalizeSong = (value) => value
      .toLocaleLowerCase('nb-NO')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const filterSongs = () => {
      const query = normalizeSong(songSearch.value.trim());
      let visible = 0;
      songItems.forEach((item) => {
        const match = !query || normalizeSong(item.textContent).includes(query);
        item.hidden = !match;
        if (match) visible += 1;
      });
      if (songCount) songCount.textContent = query
        ? `${visible} av ${songItems.length} sangforslag`
        : `${songItems.length} sangforslag`;
      if (songEmpty) songEmpty.hidden = visible !== 0;
    };
    songSearch.addEventListener('input', filterSongs);
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  if (window.matchMedia('(pointer: fine)').matches && glow) {
    window.addEventListener('pointermove', (event) => {
      glow.style.left = `${event.clientX}px`;
      glow.style.top = `${event.clientY}px`;
    }, { passive: true });
  }
})();

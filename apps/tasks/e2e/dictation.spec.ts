import { expect, test, type Page } from '@playwright/test';

type SpeechRecognitionControl = {
  starts: number;
  emit: (transcript: string) => void;
  end: () => void;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
};

async function installMockSpeechRecognition(page: Page) {
  await page.addInitScript(() => {
    const speechWindow = window as typeof window & {
      __testSpeechRecognition?: SpeechRecognitionControl;
    };
    const control: SpeechRecognitionControl = {
      starts: 0,
      emit: () => undefined,
      end: () => undefined,
    };

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;

      constructor() {
        control.emit = (transcript) => {
          this.onresult?.({
            resultIndex: 0,
            results: [
              {
                0: { transcript },
                isFinal: true,
                length: 1,
              },
            ],
          });
        };
        control.end = () => this.onend?.();
      }

      start() {
        control.starts += 1;
      }

      stop() {
        this.onend?.();
      }

      abort() {}
    }

    speechWindow.__testSpeechRecognition = control;
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: MockSpeechRecognition,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: undefined,
    });
  });
}

async function emitSpeech(page: Page, transcript: string) {
  await page.evaluate((value) => {
    const speechWindow = window as typeof window & {
      __testSpeechRecognition?: SpeechRecognitionControl;
    };
    speechWindow.__testSpeechRecognition?.emit(value);
  }, transcript);
}

async function endSpeechRecognition(page: Page) {
  await page.evaluate(() => {
    const speechWindow = window as typeof window & {
      __testSpeechRecognition?: SpeechRecognitionControl;
    };
    speechWindow.__testSpeechRecognition?.end();
  });
}

async function recognitionStarts(page: Page) {
  return page.evaluate(() => {
    const speechWindow = window as typeof window & {
      __testSpeechRecognition?: SpeechRecognitionControl;
    };
    return speechWindow.__testSpeechRecognition?.starts ?? 0;
  });
}

test('keeps listening after next and finishes only after done', async ({ page }) => {
  await installMockSpeechRecognition(page);
  await page.goto('/');
  await expect(page.getByText('Nothing here yet. Add one thing worth doing.')).toBeVisible();

  await page.getByRole('button', { name: 'Start dictation' }).click();
  await expect.poll(() => recognitionStarts(page)).toBe(1);

  await emitSpeech(page, 'Buy milk next');
  await endSpeechRecognition(page);

  await expect(page.getByText('Buy milk')).toBeVisible();
  await expect(page.getByLabel('Dictated task')).toBeVisible();
  await expect.poll(() => recognitionStarts(page)).toBe(2);

  await emitSpeech(page, 'Call dentist done');

  await expect(page.getByLabel('New task')).toBeVisible();
  await expect(page.getByText('2 open · 0 done')).toBeVisible();
  await expect(page.getByText('Call dentist')).toBeVisible();
  await expect(page.getByText('Buy milk')).toBeVisible();
});

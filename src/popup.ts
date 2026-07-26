const label = document.querySelector<HTMLElement>('#label')!;
const detail = document.querySelector<HTMLElement>('#detail')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const dot = document.querySelector<HTMLElement>('#dot')!;

async function render() {
  const { settings, events } = await chrome.runtime.sendMessage({ command: 'STATE' });
  const on = settings.observing;
  const count = events.length as number;
  label.textContent = `Observation ${on ? 'on' : 'off'}`;
  detail.textContent = `${count || 'No'} privacy-safe event${count === 1 ? '' : 's'} stored locally.`;
  toggle.textContent = on ? 'Stop observing' : 'Start observing';
  toggle.dataset.on = String(on);
  dot.classList.toggle('on', on);
  document.querySelector<HTMLElement>('#session-name-field')!.hidden = on;
  document.querySelector<HTMLElement>('#onboarding')!.hidden = settings.hasSeenOnboarding;
  document.querySelector<HTMLElement>('#controls')!.hidden = !settings.hasSeenOnboarding;
  document.querySelector<HTMLSelectElement>('#retention')!.value = settings.retentionDays === null ? 'forever' : String(settings.retentionDays);

  const list = document.querySelector<HTMLUListElement>('#exclusions')!;
  list.replaceChildren();
  for (const domain of settings.excludedDomains as string[]) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = domain;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ command: 'REMOVE_EXCLUSION', domain });
      await render();
    });
    item.append(name, remove);
    list.append(item);
  }
}

toggle.addEventListener('click', async () => {
  const starting = toggle.dataset.on !== 'true';
  const sessionName = document.querySelector<HTMLInputElement>('#session-name')!;
  await chrome.runtime.sendMessage(starting ? { command:'START', label:sessionName.value.trim() } : { command:'STOP' });
  if (starting) sessionName.value = '';
  await render();
});
document.querySelector('#viewer')!.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') }));
document.querySelector('#clear')!.addEventListener('click', async () => {
  if (confirm('Delete all captured Flowprint events?')) {
    await chrome.runtime.sendMessage({ command: 'CLEAR' });
    await render();
  }
});
document.querySelector('#exclude-form')!.addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>('#exclude-domain')!;
  input.setCustomValidity('');
  const result = await chrome.runtime.sendMessage({ command: 'EXCLUDE', domain: input.value.trim() });
  if (!result.error) {
    input.value = '';
    await render();
  } else {
    input.setCustomValidity(result.error);
    input.reportValidity();
  }
});
document.querySelector('#retention')!.addEventListener('change', async event => {
  const value = (event.target as HTMLSelectElement).value;
  await chrome.runtime.sendMessage({ command: 'RETENTION', days: value === 'forever' ? null : Number(value) });
  await render();
});
document.querySelector('#demo')!.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ command: 'LOAD_DEMO' });
  await render();
  await chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
});
document.querySelector('#onboard')!.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ command: 'ONBOARD' });
  await render();
});
void render();

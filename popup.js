'use strict';

window.onload = () => {
  const domEl = {
    appForm: document.getElementById('app-form'),
    progressWrapper: document.getElementById('progress-wrapper'),
    progressPercentage: document.getElementById('progress-percentage'),
    progressCount: document.getElementById('progress-count'),
    progressTotal: document.getElementById('progress-total'),
    progressPaid: document.getElementById('progress-paid'),
    progressStart: document.getElementById('progress-start'),
    progressEnd: document.getElementById('progress-end'),
    runButton: document.getElementById('run-button'),
    stopButton: document.getElementById('stop-button'),
  };
  const dataEl = {
    billName: document.getElementById('bill-name'),
    merchantCode: document.getElementById('merchant-code'),
    billNumber: document.getElementById('bill-number'),
    billType: document.getElementById('bill-type'),
    dpMax: document.getElementById('dp-max'),
    runCount: document.getElementById('run-count'),
  };
  const dataKeys = Object.keys(dataEl);

  const changeInputState = (enable) => {
    domEl.appForm.setAttribute('data-busy', enable ? '0' : '1');
    domEl.runButton.disabled = !enable;
    domEl.stopButton.disabled = enable;
    dataKeys.forEach((key) => {
      dataEl[key].disabled = !enable;
    });
  };

  const registerEvent = (dpMax) => {
    Object.entries(dataEl).forEach(([key, el]) => {
      el.onchange = (event) => {
        let value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        if (key === 'runCount' && value <= 0) {
          value = 1;
          event.target.value = value;
        }
        if (key === 'dpMax') {
          if (value === '' || value < 0) value = '0';
          else if (value > 99) value = '99';
          value = value.padEnd(2, '0');
          event.target.value = value;
        }
        const data = { [key]: value };
        if (key === 'runCount') {
          data.counter = 0;
        }
        chrome.storage.local.set(data, () => { console.debug('set', data); });
      };
    });

    domEl.appForm.onsubmit = (event) => {
      event.preventDefault();
      if (domEl.appForm.getAttribute('data-busy') === '1') {
        alert('執行中...');
        return;
      }
      changeInputState(false);
      chrome.storage.local.get(dataKeys, (data) => {
        console.debug('data', data);
        const required = ['billName', 'merchantCode', 'billNumber', 'billType', 'runCount'];
        const missing = required.filter((field) =>  {
          if (data[field] === undefined) {
            return true;
          }
          if (typeof data[field] === 'string' && data[field].trim() === '') {
            return true;
          }
          return false;
        });
        if (missing.length > 0) {
          console.debug('missing', missing);
          alert("缺少參數");
          changeInputState(true);
          return;
        }
        if (data.runCount <= 0) {
          console.debug('invalid runCount:', data.runCount);
          alert("錯誤參數");
          changeInputState(true);
          return;
        }

        const formData = {};
        Object.entries(dataEl).forEach(([key, el]) => {
          const value = el.type === 'checkbox' ? el.checked : el.value;
          formData[key] = value;
        });
        const state = {
          ...formData,
          running: true,
          counter: 0,
          paid: '0.00',
          start: (new Date()).toLocaleString(),
          end: null,
          error: null,
        };
        chrome.storage.local.set(state, () => {
          console.debug('start running');
          chrome.tabs.executeScript({
            code: `
              setTimeout(() => {
                const form = document.querySelector('form[name="submitForm"]');
                if (form) {
                  form.action = '/pps/AppLoadBill';
                  form.submit();
                } else {
                  alert('請先登入!');
                }
              }, 300);
            `,
          }, () => {
            console.debug('Script executed');
          });
        });
      });
    };

    domEl.stopButton.onclick = () => {
      chrome.storage.local.set({ running: false, end: (new Date()).toLocaleString() }, () => {
        console.debug('user interrupted');
      });
    };
  };

  // entry point
  chrome.storage.local.get([...dataKeys, 'running', 'paid', 'dpMax', 'start', 'end'], (data) => {
    Object.entries(data).forEach(([key, value]) => {
      if (dataEl[key]) {
        const el = dataEl[key];
        if (el.type === 'checkbox') {
          el.checked = value;
        } else {
          el.value = value;
        }
        if (key === 'runCount') {
          domEl.progressTotal.innerHTML = value;
        }
      } else if (key === 'running') {
        changeInputState(!value);
      } else if (key === 'paid') {
        domEl.progressPaid.innerHTML = value;
      } else if (key === 'start') {
        domEl.progressStart.innerHTML = value || '';
      } else if (key === 'end') {
        domEl.progressEnd.innerHTML = value || '';
      }
    });
    registerEvent(data.dpMax);
    domEl.appForm.style.display = '';
    domEl.progressWrapper.style.display = '';
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') {
      return;
    }
    Object.entries(changes).forEach(([key, change]) => {
      let updatePercentage = false;
      if (key === 'running') {
        changeInputState(!change.newValue);
      } else if (key === 'counter') {
        domEl.progressCount.innerHTML = change.newValue;
        updatePercentage = true;
      } else if (key === 'runCount') {
        console.debug(key, change);
        domEl.progressTotal.innerHTML = change.newValue;
        updatePercentage = true;
      } else if (key === 'paid') {
        domEl.progressPaid.innerHTML = change.newValue;
      } else if (key === 'start') {
        domEl.progressStart.innerHTML = change.newValue || '';
      } else if (key === 'end') {
        domEl.progressEnd.innerHTML = change.newValue || '';
      }
      if (updatePercentage) {
        const count = parseInt(domEl.progressCount.innerHTML, 10);
        const total = parseInt(domEl.progressTotal.innerHTML, 10);
        const percentage = Math.floor(count / total * 100) + ' %';
        domEl.progressPercentage.innerHTML = percentage;
      }
    });
  });
};

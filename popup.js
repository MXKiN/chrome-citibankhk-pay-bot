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
    totalWrapper: document.getElementById('total-wrapper'),
    runCountWrapper: document.getElementById('run-count-wrapper'),
    targetAmountWrapper: document.getElementById('target-amount-wrapper'),
  };
  const dataEl = {
    billName: document.getElementById('bill-name'),
    merchantCode: document.getElementById('merchant-code'),
    billNumber: document.getElementById('bill-number'),
    billType: document.getElementById('bill-type'),
    dpMin: document.getElementById('dp-min'),
    dpMax: document.getElementById('dp-max'),
    runCount: document.getElementById('run-count'),
    targetAmount: document.getElementById('target-amount'),
    runMode: document.getElementById('run-mode'),
  };
  const dataKeys = Object.keys(dataEl);

  const changeInputState = enable => {
    domEl.appForm.setAttribute('data-busy', enable ? '0' : '1');
    domEl.runButton.disabled = !enable;
    domEl.stopButton.disabled = enable;
    dataKeys.forEach(key => {
      dataEl[key].disabled = !enable;
    });
  };

  const registerEvent = () => {
    Object.entries(dataEl).forEach(([key, el]) => {
      el.onchange = event => {
        let value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        if (['runCount', 'targetAmount'].indexOf(key) > -1) {
          const max = 1000000000;
          if (value <= 0) {
            value = 1;
            event.target.value = value;
          } else if (value > max) {
            value = max;
            event.target.value = value;
          }
        }
        if (key === 'dpMin' || key === 'dpMax') {
          if (value === '' || value < 0) value = '0';
          else if (value > 99) value = '99';
          value = value.padEnd(2, '0');
          event.target.value = value;
        }
        if (key === 'runMode') {
          if (value === 'repeat') {
            domEl.targetAmountWrapper.style.display = 'none';
            domEl.runCountWrapper.style.display = '';
            domEl.totalWrapper.style.display = '';
          } else if (value === 'target') {
            domEl.targetAmountWrapper.style.display = '';
            domEl.runCountWrapper.style.display = 'none';
            domEl.totalWrapper.style.display = 'none';
          }
        }
        const data = {
          [key]: value,
          counter: 0,
          paid: '0.00',
          start: null,
          end: null,
        };
        chrome.storage.local.set(data, () => {
          console.debug('set', data);
        });
      };
    });

    domEl.appForm.onsubmit = event => {
      event.preventDefault();
      if (domEl.appForm.getAttribute('data-busy') === '1') {
        alert('正在執行中! Already Processing!');
        return;
      }
      changeInputState(false);
      chrome.storage.local.get(dataKeys, data => {
        console.debug('data', data);
        const required = ['billName', 'merchantCode', 'billNumber', 'billType', 'runCount'];
        const missing = required.filter(field => {
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
          alert('缺少參數! Missing Arguments!');
          changeInputState(true);
          return;
        }
        if (data.runCount <= 0) {
          console.debug('invalid runCount:', data.runCount);
          alert('錯誤參數! Invalid Arguments!');
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
          interrupted: false,
          counter: 0,
          paid: '0.00',
          start: new Date().toLocaleString(),
          end: null,
          error: null,
        };
        chrome.storage.local.set(state, () => {
          console.debug('start running');
          chrome.tabs.executeScript(
            {
              code: `
              setTimeout(() => {
                const form = document.querySelector('form[name="submitForm"]');
                if (form) {
                  form.action = '/pps/AppLoadBill';
                  (form.querySelector('input[name="TYPE"]') || {}).value = '';
                  const loading = document.getElementById('loadingmsg_new');
                  if (loading) loading.style.visibility = 'visible';
                  form.submit();
                } else {
                  alert('請先登入! Please Login!');
                }
              }, 300);
            `,
            },
            () => {
              console.debug('Script executed');
            }
          );
        });
      });
    };

    domEl.stopButton.onclick = () => {
      chrome.storage.local.set({ interrupted: true }, () => {
        console.debug('user interrupted');
        chrome.tabs.executeScript(
          {
            code: `
            const form = document.querySelector('form[name="submitForm"]');
            if (!form) {
              setTimeout(() => {
                location.href = 'https://ppshk.com';
              }, 300);
            }
          `,
          },
          () => {}
        );
      });
    };
  };

  const updateValue = (key, value, allowUpdateInput) => {
    if (allowUpdateInput && dataEl[key]) {
      const el = dataEl[key];
      if (el.type === 'checkbox') {
        el.checked = value;
      } else {
        el.value = value;
      }
    }
    if (key === 'running') {
      changeInputState(!value);
    } else if (key === 'counter') {
      domEl.progressCount.innerHTML = value;
    } else if (key === 'runCount') {
      domEl.progressTotal.innerHTML = value;
    } else if (key === 'paid') {
      domEl.progressPaid.innerHTML = value;
    } else if (key === 'start') {
      domEl.progressStart.innerHTML = value || '';
    } else if (key === 'end') {
      domEl.progressEnd.innerHTML = value || '';
    } else if (key === 'runMode') {
      if (value === 'repeat') {
        domEl.targetAmountWrapper.style.display = 'none';
        domEl.runCountWrapper.style.display = '';
        domEl.totalWrapper.style.display = '';
      } else if (value === 'target') {
        domEl.targetAmountWrapper.style.display = '';
        domEl.runCountWrapper.style.display = 'none';
        domEl.totalWrapper.style.display = 'none';
      }
    }
    if (['counter', 'runCount', 'paid'].indexOf(key) > -1) {
      let percentage = '-';
      if (dataEl.runMode.value === 'repeat') {
        const count = parseInt(domEl.progressCount.innerHTML, 10);
        const total = parseInt(domEl.progressTotal.innerHTML, 10);
        percentage = Math.floor((count / total) * 100) + ' %';
      } else if (dataEl.runMode.value === 'target') {
        const paid = domEl.progressPaid.innerHTML;
        const target = dataEl.targetAmount.value;
        percentage = Math.floor((paid / target) * 100) + ' %';
      }
      domEl.progressPercentage.innerHTML = percentage;
    }
  };

  const registerStorageChangeEvent = () => {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace !== 'local') {
        return;
      }
      Object.entries(changes).forEach(([key, change]) => {
        updateValue(key, change.newValue, false);
      });
    });
  };

  chrome.storage.local.get([...dataKeys, 'running', 'counter', 'paid', 'start', 'end'], data => {
    Object.entries(data).forEach(([key, value]) => {
      updateValue(key, value, true);
    });
    registerEvent();
    registerStorageChangeEvent();
    domEl.appForm.style.display = '';
    domEl.progressWrapper.style.display = '';
  });
};

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
    merchantCode: document.getElementById('merchant-code'),
    billNumber: document.getElementById('bill-number'),
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
          paid: 0,
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
        const required = ['merchantCode', 'billNumber', 'runCount'];
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
          paid: 0,
          currentAmt: 0,
          start: new Date().toLocaleString(),
          end: null,
          error: null,
        };

        chrome.storage.local.set(state, () => {
          chrome.tabs.executeScript(
            {
              code: `
              {
                const stopFlow = () => {
                  const end = new Date().toLocaleString();
                  chrome.storage.local.set(
                    {
                      running: false,
                      interrupted: false,
                      end,
                    },
                    () => {
                      console.debug('stop running');
                    }
                  );
                };

                const waitStartPage = () => {
                  const checkLoading = () => {
                    chrome.storage.local.get(['interrupted'], data => {
                      if (data.interrupted) {
                        stopFlow();
                      }
                      else {
                        var display = document.getElementById('COACommon_spinner').style.display;
                        if (display === 'none') {
                          var button = document.getElementById('toAccount_button');
                          if (button !== null) {
                            chrome.storage.local.get(['runMode', 'counter', 'runCount', 'targetAmount', 'paid'], state => {
                              const completed = (state.runMode === 'repeat')
                                ? (state.counter >= state.runCount)
                                : (Math.floor(state.paid) >= Math.floor(state.targetAmount));
                              if (completed) {
                                stopFlow();
                              }
                              else {
                                const waitTime = Math.floor(Math.random() * 500) + 2500;
                                setTimeout(() => {
                                  chooseAccounts();
                                }, waitTime);
                              }
                            });
                          }
                          else {
                            setTimeout(checkLoading, 500);
                          }
                        }
                        else {
                          setTimeout(checkLoading, 500);
                        }
                      }
                    });
                  };

                  setTimeout(checkLoading, 1000);
                };

                const waitDonePage = () => {
                  chrome.storage.local.get(['interrupted'], data => {
                    if (data.interrupted) {
                      stopFlow();
                    }
                    else {
                      if (document.getElementById('mp5-conf-done') !== null) {
                        const waitTime = Math.floor(Math.random() * 400) + 200;
                        setTimeout(() => {
                          chrome.storage.local.get(['counter', 'currentAmt', 'paid'], state => {
                            console.debug('paid LLM yeah!');
                            state.counter += 1;
                            state.paid += state.currentAmt;
                            chrome.storage.local.set(state, () => {
                              document.getElementById('mp5-conf-done').click();
                              setTimeout(waitStartPage, 100);
                            });
                          });
                        }, waitTime);
                      }
                      else if (document.querySelector('[id^="jba-eot-ok-btn"]') !== null) {
                        const waitTime = Math.floor(Math.random() * 400) + 200;
                        setTimeout(() => {
                          console.debug('diu pay ng dou LLM tim :(');
                          document.querySelector('[id^="jba-eot-ok-btn"]').click();
                          setTimeout(waitStartPage, 100);
                        }, waitTime);
                      }
                      else {
                        setTimeout(waitDonePage, 500);
                      }
                    }
                  });
                };

                const waitConfirmPage = () => {
                  chrome.storage.local.get(['interrupted'], data => {
                    if (data.interrupted) {
                      stopFlow();
                    }
                    else {
                      if (document.getElementById('mp5-recap-confirm') !== null) {
                        const waitTime = Math.floor(Math.random() * 400) + 200;
                        setTimeout(() => {
                          document.getElementById('mp5-recap-confirm').click();
                          setTimeout(waitDonePage, 100);
                        }, waitTime);
                      }
                      else {
                        setTimeout(waitConfirmPage, 500);
                      }
                    }
                  });
                };

                const enterPaymentAmount = () => {
                  chrome.storage.local.get(['interrupted', 'currentAmt', 'dpMax', 'dpMin'], data => {
                    if (data.interrupted) {
                      stopFlow();
                    }
                    else {
                      //const amt = (Math.floor(Math.random() * 90) + 100) / 100;
                      const amt = (Math.floor(Math.random() * Math.floor(data.dpMax)) + Math.floor(data.dpMin) + 100) / 100;
                      document.getElementById('firstTransactionAmount').value = amt;
                      data.currentAmt = amt;
                      chrome.storage.local.set(data, () => {
                        const waitTime = Math.floor(Math.random() * 400) + 200;
                        setTimeout(() => {
                          document.getElementById('Next-MP5-Payment').click();
                          setTimeout(waitConfirmPage, 100);
                        }, waitTime);
                      });
                    }
                  });
                };

                const waitPaymentPage = () => {
                  chrome.storage.local.get(['interrupted'], data => {
                    if (data.interrupted) {
                      stopFlow();
                    }
                    else {
                      if (document.getElementById('firstTransactionAmount') !== null) {
                        const waitTime = Math.floor(Math.random() * 400) + 200;
                        setTimeout(enterPaymentAmount, waitTime);
                      }
                      else {
                        setTimeout(waitPaymentPage, 500);
                      }
                    }
                  });
                };

                const chooseAccounts = () => {
                  chrome.storage.local.get(['interrupted', 'merchantCode', 'billNumber'], data => {
                    if (data.interrupted) {
                      stopFlow();
                    }
                    else {
                      const waitTime = Math.floor(Math.random() * 400) + 200;
                      document.getElementById('toAccount_button').click();
                      setTimeout(() => {
                        for (i = 0; i < 99; i++) {
                          element = document.querySelector('#acbol_common_t_sDashboard > ul > li:nth-child(' + i + ') > a');
                          if (element !== null && 
                              element.innerText.indexOf(data.merchantCode) !== -1) {
                            break;
                          }
                          else {
                            element = null;
                          }
                        }
                        if (element !== null) {
                          element.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
                          element.click();
                          const waitTime = Math.floor(Math.random() * 400) + 200;
                          setTimeout(() => {
                            document.getElementById('fromAccount_button').click();
                            const waitTime = Math.floor(Math.random() * 400) + 200;
                            setTimeout(() => {
                              for (i = 37; i > 30; i--) {
                                for (j = 0; j < 99; j++) {
                                  element = document.querySelector('#acbol_common_t_sDashboard > ul:nth-child(' + i + ') > li:nth-child(' + j + ') > a');
                                  if (element !== null &&
                                      element.innerText.indexOf(data.billNumber) !== -1) {
                                    break;
                                  }
                                  else  {
                                    element = null;
                                  }
                                }
                                if (element !== null) break;
                              }

                              if (element !== null) {
                                element.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
                                element.click();
                                setTimeout(waitPaymentPage, 100);
                              }
                              else {
                                alert('From Account containing ' + data.billNumber + ' not found!');
                                stopFlow();
                              }
                            }, waitTime);
                          }, waitTime);
                        }
                        else {
                          alert('To Account containing ' + data.merchantCode + ' not found!');
                          stopFlow();
                        }
                      }, waitTime);
                    }
                  });
                };

                setTimeout(() => {
                  if (document.getElementById('toAccount_button') !== null) {
                    chooseAccounts();
                  }
                  else {
                    alert('Please navigate to Payments & Transfers page.');
                    stopFlow();
                  }
                }, 100);
              }
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
              console.debug('stop');
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
      domEl.progressPaid.innerHTML = Math.round(value * 100) / 100;
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

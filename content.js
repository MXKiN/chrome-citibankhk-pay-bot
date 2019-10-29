'use strict';

NodeList.prototype.elements = function() {
  return Array.from(NodeList.prototype.entries.call(this), e => e.pop());
};

const afterLoaded = (doc, fn) => {
  const runFn = () => {
    if (doc.readyState == 'complete') {
      console.debug('run fn:', fn.name || fn);
      setTimeout(fn, 0);
      return true;
    }
    return false;
  };
  if (!runFn()) {
    console.debug('add listenr for run fn:', fn.name || fn);
    doc.addEventListener('readystatechange', () => {
      runFn();
    });
  }
};

const preprocess = (num) => {
  num = typeof num === 'number' ? Number(num).toString() : num;
  if (typeof num !== 'string') {
    throw new Error('Unsupported argument type, required number / string');
  }
  num = num.trim();
  if (num.startsWith('-')) {
    throw new Error('Not support negative values');
  }
  if (num.toLowerCase().indexOf('e') > -1) {
    throw new Error('Not support scientific notation');
  }
  return num;
};

const sum = (a, b) => {
  a = preprocess(a);
  b = preprocess(b);
  let [i1, dp1 = '0'] = a.split('.');
  let [i2, dp2 = '0'] = b.split('.');
  let i = Number(i1) + Number(i2);
  const length = dp1.length > dp2.length ? dp1.length : dp2.length;
  dp1 = dp1.padEnd(length, '0');
  dp2 = dp2.padEnd(length, '0');
  let dp = (Number(dp1) + Number(dp2)).toString().padStart(length, '0');
  if (dp.length > length) {
    dp = dp.substr(1);
    i += 1;
  }
  return `${i}.${dp}`;
};

const gte = (a, b) => {
  a = preprocess(a);
  b = preprocess(b);
  let [i1, dp1 = '0'] = a.split('.');
  let [i2, dp2 = '0'] = b.split('.');
  i1 = Number(i1);
  i2 = Number(i2);
  if (i1 < i2) {
    return false;
  } else if (i1 > i2 || dp1 === dp2) {
    return true;
  }
  const length = dp1.length > dp2.length ? dp1.length : dp2.length;
  dp1 = dp1.padEnd(length, '0');
  dp2 = dp2.padEnd(length, '0');
  for (let i = 0; i < length; i++) {
    if (dp1[i] !== dp2[i]) {
      return Number(dp1[i]) > Number(dp2[i]);
    }
  }
  return true;
};

const displayContent = content => {
  const div = document.createElement('div');
  div.classList.add('app__message-box');
  div.innerHTML = content;
  document.body.prepend(div);
};

const stopApp = (error = null) => {
  if (error) {
    console.debug('Error:', error);
    displayContent(`<span class="error">[Error] ${error}</span>`);
  }
  const end = new Date().toLocaleString();
  chrome.storage.local.set(
    {
      running: false,
      interrupted: false,
      end,
      error,
    },
    () => {
      console.debug('stop running');
    }
  );
};

const constructFn = fn => (...args) => {
  try {
    fn(...args);
  } catch (error) {
    console.error(error);
    stopApp(error.message);
  }
};

const isLoggedIn = () => document.getElementById('but_logout') !== null;

const handleNotLoggedIn = () => {
  console.debug('not yet login');
  if (
    ['/', '/pps/pps2/revamp2/template/pc/login.jsp', '/pps/pps2/revamp2/template/pc/login_c.jsp'].indexOf(
      location.pathname
    ) > -1
  ) {
    return;
  }
  const loginUrl = {
    chinese: 'https://www.ppshk.com/pps/pps2/revamp2/template/pc/login_c.jsp',
    english: 'https://www.ppshk.com/pps/pps2/revamp2/template/pc/login.jsp',
  };
  if (['/index_e.html', '/index_c.html'].indexOf(location.pathname) > -1) {
    const mainDoc = document.body.querySelector('frame').contentDocument;
    if (!mainDoc) {
      return;
    }
    afterLoaded(mainDoc, () => {
      const menuDoc = mainDoc.getElementById('menu').contentDocument;
      if (!menuDoc) {
        return;
      }
      afterLoaded(menuDoc, () => {
        const loginButtons = {
          english: (menuDoc.querySelector('img[alt="Login"]') || {}).parentElement,
          chinese: (menuDoc.querySelector('img[alt="登入"]') || {}).parentElement,
        };
        Object.entries(loginButtons).forEach(([lang, button]) => {
          if (button) {
            const attr = button.getAttribute('onclick');
            const link = attr.match(/.+\'(.+)\'.+/)[1] || null;
            button.addEventListener(
              'click',
              event => {
                event.stopPropagation();
              },
              true
            );
            button.href = link || loginUrl[lang];
            button.target = '_top';
          }
        });
      });
    });
  } else {
    const buttons =
      `<a target="_self" href="${loginUrl.english}" class="app__login-button">Login</a>` +
      ' / ' +
      `<a target="_self" href="${loginUrl.chinese}" class="app__login-button">登入</a>`;
    displayContent(buttons);
  }
};

const chooseBill = (billName, merchantCode, billNumber) => {
  console.debug('choose bill');
  const ppsForm = document.querySelector('form[name="ppsForm"]');
  if (!ppsForm) {
    throw new Error('找不到PPS表格! PPS form not found!');
  }
  ppsForm.merchantCode.value = merchantCode;
  ppsForm.merchantName.value = billName;
  ppsForm.billNumber.value = billNumber;
  ppsForm.ISAUTHFLAGON.value = document.querySelector('input[name="ISAUTHFLAGON"]').value;
  ppsForm.TYPE.value = 'DISP_FORM';
  setTimeout(() => ppsForm.submit(), 0);
};

const fillBillData = (billType, amount) => {
  console.debug('fill bill data');
  const proceedButton = document.querySelector('img[name="proceedBut"]').parentElement;
  if (!proceedButton) {
    stopApp('找不到繼續按鈕! Cannot find continue button!');
    return;
  }

  billType = billType || '0';
  const type = parseInt(billType, 10);
  const billTypeSelect = document.querySelector('select[name="BILLTYPE"]');
  if (billTypeSelect && type === 0) {
    stopApp('帳單需要填寫類別! Bill requires to fill type!');
    return;
  }
  if (type !== 0) {
    const typeOption = !billTypeSelect
      ? null
      : billTypeSelect
          .querySelectorAll('option')
          .elements()
          .filter(o => parseInt(o.value, 10) === type)
          .pop();
    if (!typeOption) {
      stopApp(`未能找到帳單類別: ${billType} | Bill Type ${billType} Not Found`);
      return;
    }
    billTypeSelect.value = typeOption.value;
    const evt = document.createEvent('HTMLEvents');
    evt.initEvent('change', false, true);
    billTypeSelect.dispatchEvent(evt);
  }
  const amountInput = document.querySelector('input[name="AMOUNT"]');
  amountInput.value = amount;

  chrome.storage.local.set(
    { lastPaid: amount },
    constructFn(() => {
      const typeFilled = billTypeSelect ? parseInt(billTypeSelect.value, 10) === type : true;
      if (typeFilled && amountInput.value === amount) {
        console.debug('set lastPaid', amount);
        setTimeout(() => proceedButton.click(), 0);
      } else {
        stopApp('未能成功填寫賬單數據! Fail to fill bill data into form!');
      }
    })
  );
};

const confirmPayBill = () => {
  console.debug('confirm pay bill');
  const images = document.querySelectorAll('a > img[src]').elements();
  const buttonImage = images.filter(img => img.src.endsWith('but_pay2.gif')).pop();
  const confirmButton = buttonImage ? buttonImage.parentElement : null;
  if (!confirmButton) {
    stopApp('找不到確認按鈕! Fail to find confirm button!');
    return;
  }
  setTimeout(() => confirmButton.click(), 0);
};

const verifySuccess = counter => {
  const crossImage = document
    .querySelectorAll('img[src]')
    .elements()
    .filter(img => img.src.endsWith('cross.jpg'))
    .pop();
  if (crossImage) {
    stopApp('交易失敗，請查看PPS HK頁面之訊息。 Transaction Failed, please check PPS HK messages.');
    return;
  }
  chrome.storage.local.get(
    ['lastPaid', 'paid', 'runMode', 'runCount', 'targetAmount'],
    constructFn(({ lastPaid, paid, runMode, runCount, targetAmount }) => {
      console.debug('get lastPaid', lastPaid);
      paid = sum(paid, lastPaid);
      const state = {
        counter,
        paid,
        lastPaid: '0',
      };
      const completed = (runMode === 'repeat')
        ? (counter >= runCount)
        : (gte(paid, targetAmount));
      chrome.storage.local.set(
        state,
        constructFn(() => {
          if (completed) {
            stopApp();
            displayContent('己完成! Completed!');
          } else {
            const form = document.querySelector('form[name="submitForm"]');
            if (!form) {
              stopApp('找不到轉頁表格! Cannot find redirect form!');
              return;
            }
            (form.querySelector('input[name="TYPE"]') || {}).value = '';
            form.action = '/pps/AppLoadBill';
            setTimeout(() => {
              const loading = document.getElementById('loadingmsg_new');
              if (loading) loading.style.visibility = 'visible';
              form.submit();
            }, 0);
          }
        })
      );
    })
  );
};

const generateBillAmount = (dpMin, dpMax) => {
  const minValue = parseInt(dpMin, 10)
  const maxValue = parseInt(dpMax, 10)
  const diff = Math.abs(maxValue - minValue);
  return `1.${Math.floor(Math.random() * (diff + 1) + minValue)
    .toString()
    .padStart(2, '0')}`;
};

const handle = data => {
  if (['/pps/AppLoadBill', '/pps/AppUserLogin'].indexOf(location.pathname) > -1) {
    chooseBill(data.billName, data.merchantCode || null, data.billNumber || null);
  } else if (location.pathname === '/pps/AppPayBill') {
    const amountInput = document.querySelector('input[name="AMOUNT"]');
    if (amountInput && amountInput.type === 'text') {
      const amount = generateBillAmount(data.dpMin, data.dpMax);
      const fillData = () => fillBillData(data.billType, amount);
      afterLoaded(document, fillData);
    } else if (amountInput && amountInput.type === 'hidden') {
      confirmPayBill();
    } else {
      verifySuccess(data.counter + 1);
    }
  }
};

if (!isLoggedIn()) {
  handleNotLoggedIn();
  chrome.storage.local.get(
    ['interrupted'],
    constructFn(data => {
      if (data.interrupted) {
        stopApp();
      }
    })
  );
} else {
  chrome.storage.local.get(
    ['running', 'interrupted', 'counter', 'runCount', 'billName', 'merchantCode', 'billNumber', 'billType', 'amountFloating', 'dpMin', 'dpMax'],
    constructFn(data => {
      console.debug(location.pathname, data);
      if (data.running) {
        handle(data);
      }
      if (data.interrupted) {
        stopApp();
      }
    })
  );
}

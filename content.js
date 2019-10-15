'use strict';

NodeList.prototype.elements = function () {
  return Array.from(NodeList.prototype.entries.call(this), e => e.pop());
};

const submitDelayMs = 300;

const sum = (a, b) => {
    a = (typeof a === 'number') ? Number(a).toString() : a;
    b = (typeof b === 'number') ? Number(b).toString() : b;
    if (typeof a !== 'string' || typeof b !== 'string') {
        throw new Error('Invalid arguments, required 2 number string as arguments!');
    }
    a = a.trim();
    b = b.trim();
    if (a.startsWith('-') || b.startsWith('-')) {
        throw new Error('Not support negative values');
    }
    if (a.toLowerCase().indexOf('e') > -1 || b.toLowerCase().indexOf('e') > 1) {
        throw new Error('Not support scientific notation');
    }
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

const stopApp = (error = null) => {
  if (error) {
    console.debug('Error:', error);
    displayContent(`<span class="error">[Error] ${error}</span>`);
  }
  const end = (new Date()).toLocaleString();
  chrome.storage.local.set({ running: false, end, error }, () => {
    console.debug('stop running');
  });
};

const isLoggedIn = () => document.getElementById('but_logout') !== null;

const displayContent = (content) => {
  const div = document.createElement('div');
  div.classList.add('app__message-box');
  div.innerHTML = content;
  document.body.prepend(div);
};

const handleNotLoggedIn = () => {
  console.debug('not yet login');
  if ([
    '/',
    '/index_c.html',
    '/pps/pps2/revamp2/template/pc/login.jsp',
    '/pps/pps2/revamp2/template/pc/login_c.jsp',
  ].indexOf(location.pathname) > -1) {
    return;
  }
  const loginUrl = {
    chinese: 'https://www.ppshk.com/pps/pps2/revamp2/template/pc/login_c.jsp',
    english: 'https://www.ppshk.com/pps/pps2/revamp2/template/pc/login.jsp',
  };
  displayContent(`
    <a target="_self" href="${loginUrl.english}" class="app__login-button">Login</a>
    /
    <a target="_self" href="${loginUrl.chinese}" class="app__login-button">登入</a>
  `);
};

const chooseBill = (billName, merchantCode, billNumber) => {
  console.debug('choose bill');
  const ppsForm = document.querySelector('form[name="ppsForm"]');
  ppsForm.merchantCode.value = merchantCode;
  ppsForm.merchantName.value = billName;
  ppsForm.billNumber.value = billNumber;
	ppsForm.ISAUTHFLAGON.value = document.querySelector('input[name="ISAUTHFLAGON"]').value;
  ppsForm.TYPE.value = 'DISP_FORM';
  setTimeout(() => { ppsForm.submit(); }, submitDelayMs);
};

const fillBillData = (billType, amount, retry = true) => {
  console.debug('fill bill data');
  const proceedButton = document.querySelector('img[name="proceedBut"]').parentElement;
  if (!proceedButton) {
    stopApp("Proceed button not found");
    return;
  }
  const type = parseInt(billType, 10);
  const billTypeSelect = document.querySelector('select[name="BILLTYPE"]');
  if (billTypeSelect && type === 0) {
    stopApp("帳單需要填寫類別");
    return;
  }
  if (type !== 0) {
    const typeOption = !billTypeSelect ? null : billTypeSelect.querySelectorAll('option').elements().filter(o => parseInt(o.value, 10) === type).pop();
    if (!typeOption) {
      stopApp("未能找到帳單類別: " + billType);
      return;
    }
    billTypeSelect.value = typeOption.value;
    const evt = document.createEvent('HTMLEvents');
    evt.initEvent('change', false, true);
    billTypeSelect.dispatchEvent(evt);
  }
  const amountInput = document.querySelector('input[name="AMOUNT"]');
  amountInput.value = amount;
  chrome.storage.local.set({ lastPaid: amount }, () => {
    const typeFilled = billTypeSelect ? parseInt(billTypeSelect.value, 10) === type : true;
    if (typeFilled && amountInput.value === amount) {
      console.debug('set lastPaid', amount);
      setTimeout(() => { proceedButton.click(); }, submitDelayMs);
    } else if (retry) {
      console.debug('retry fill bill data');
      setTimeout(() => { fillBillData(billType, amount, false); }, 500);
    } else {
      stopApp('Fail to fill bill data');
    }
  });
};

const confirmPayBill = () => {
  console.debug('confirm pay bill');
  const images = document.querySelectorAll('a > img[src]').elements();
  const buttonImage = images.filter(img => img.src.endsWith('but_pay2.gif')).pop();
  if (!buttonImage) {
    stopApp('Confirm button not found');
    return;
  }
  const confirmButton = buttonImage.parentElement;
  setTimeout(() => { confirmButton.click(); }, submitDelayMs);
};

const verifySuccess = (counter) => {
  const fail = document.querySelectorAll('img[src]').elements().filter(img => img.src.endsWith('cross.jpg')).length > 0;
  if (fail) {
    stopApp('交易失敗，請查看PPS HK頁面之訊息。');
    return;
  }
  chrome.storage.local.get(['lastPaid', 'paid', 'runCount'], ({ lastPaid, paid, runCount }) => {
    console.debug('get lastPaid', lastPaid);
    paid = sum(paid, lastPaid);
    const state = { counter, paid, lastPaid: '0' };
    if (counter == runCount) {
      state.end = (new Date()).toLocaleString();
    }
    chrome.storage.local.set(state, () => {
      if (state.end) {
        stopApp();
        displayContent('己完成');
      } else {
        const form = document.querySelector('form[name="submitForm"]');
        form.action = '/pps/AppLoadBill';
        form.submit();
      }
    });
  });
};

const handle = (data) => {
  try {
    if (location.pathname === '/pps/AppLoadBill' || location.pathname === '/pps/AppUserLogin') {
      chooseBill(data.billName, data.merchantCode || null, data.billNumber || null);
    } else if (location.pathname === '/pps/AppPayBill') {
      const amountInput = document.querySelector('input[name="AMOUNT"]');
      if (amountInput && amountInput.type === 'text') {
        const amount = `1.${Math.floor(Math.random() * data.dpMax).toString().padStart(2, '0')}`
        setTimeout(() => {
          fillBillData(data.billType || '0', amount);
        }, 0);
      } else if (amountInput && amountInput.type === 'hidden') {
        confirmPayBill();
      } else {
        verifySuccess(data.counter + 1);
      }
    }
  } catch (error) {
    console.error(error);
    stopApp(error.message);
  }
};

if (!isLoggedIn()) {
  handleNotLoggedIn();
} else {
  chrome.storage.local.get([
    'running', 'counter', 'runCount',
    'billName', 'merchantCode', 'billNumber',
    'billType', 'amountFloating', 'dpMax',
  ], (data) => {
    console.debug(location.pathname, data);
    if (!data.running) {
      return;
    }
    handle(data);
  });
}

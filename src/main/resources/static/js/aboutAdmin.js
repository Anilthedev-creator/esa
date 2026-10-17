/* the about editor reads saved values into the fields before someone changes them */
(function () {
  var fields = [
    'story', 'heading1', 'paragraph1', 'paragraph3', 'heading2', 'paragraph2',
    'specialist1Name', 'specialist1Position', 'specialist1Biography',
    'specialist2Name', 'specialist2Position', 'specialist2Biography'
  ];
  var savedValues = {};

  if (!localStorage.getItem('token')) {
    window.location.replace('signin.html?next=aboutPageAdmin.html');
    return;
  }

  function authHeaders() {
    var token = localStorage.getItem('token');
    if (!token) {
      window.location.replace('signin.html?next=aboutPageAdmin.html');
      throw new Error('Please sign in again.');
    }
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
  }

  function showStatus(message, isError) {
    var status = document.getElementById('saveStatus');
    status.textContent = message;
    status.style.color = isError ? '#b42318' : '#16734b';
  }

  async function loadAboutContent() {
    var response = await fetch('/about');
    var data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not load about content.');

    fields.forEach(function (field) {
      var value = data[field] == null ? '' : String(data[field]);
      document.getElementById(field).value = value;
      savedValues[field] = value;
    });
  }

  async function saveAboutContent() {
    var button = document.getElementById('saveButton');
    var changes = {};
    fields.forEach(function (field) {
      var value = document.getElementById(field).value;
      if (value !== savedValues[field]) changes[field] = value;
    });

    if (!Object.keys(changes).length) {
      showStatus('Nothing to save.', false);
      return;
    }

    button.disabled = true;
    showStatus('Saving…', false);
    try {
      var response = await fetch('/about', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(changes)
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not save about content.');

      // read it back from the server so the editor shows the saved copy
      await loadAboutContent();
      showStatus('Saved. Your changes will still be here after refresh.', false);
    } catch (error) {
      showStatus(error.message || 'Could not save about content.', true);
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('saveButton').addEventListener('click', saveAboutContent);
    loadAboutContent().catch(function (error) {
      showStatus(error.message || 'Could not load about content.', true);
    });
  });
})();

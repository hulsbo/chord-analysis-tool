// Chord root note mapping (C=0, C#/Db=1, ..., B=11)
const NOTE_TO_NUM = {
	'C': 0, 'B#': 0,
	'C#': 1, 'Db': 1,
	'D': 2,
	'D#': 3, 'Eb': 3,
	'E': 4, 'Fb': 4,
	'F': 5, 'E#': 5,
	'F#': 6, 'Gb': 6,
	'G': 7,
	'G#': 8, 'Ab': 8,
	'A': 9,
	'A#': 10, 'Bb': 10,
	'B': 11, 'Cb': 11
  };
  
  function parseChordRoot(chord) {
	// Extract root (e.g. C, D#, Eb, F, etc.)
	const match = chord.match(/^([A-G](?:#|b)?)/i);
	if (!match) return null;
	let root = match[1].toUpperCase();
	// Normalize flats/sharps
	if (root.length === 2 && root[1] === 'B') root = root[0] + 'b';
	if (root.length === 2 && root[1] === '#') root = root[0] + '#';
	return NOTE_TO_NUM[root] !== undefined ? NOTE_TO_NUM[root] : null;
  }
  
  function getIntervals(baseNotes) {
	// Calculate chromatic intervals mod 12, return signed intervals with + or -
	const intervals = [];
	for (let i = 1; i < baseNotes.length; ++i) {
	  let up = (baseNotes[i] - baseNotes[i-1] + 12) % 12;
	  let down = (baseNotes[i-1] - baseNotes[i] + 12) % 12;
	  let sign, val;
	  if (up === 6 && down === 6) {
		// Tritone: always choose +6
		sign = '+';
		val = 6;
	  } else if (up <= down) {
		sign = '+';
		val = up > 6 ? 12 - up : up;
	  } else {
		sign = '-';
		val = down > 6 ? 12 - down : down;
	  }
	  intervals.push({ sign, val });
	}
	return intervals;
  }
  
  function intervalFrequency(intervals) {
	// Count frequency of intervals 0-6 (ignore sign)
	const freq = Array(7).fill(0);
	intervals.forEach(i => {
	  const v = typeof i === 'object' ? i.val : i;
	  if (v >= 0 && v <= 6) freq[v]++;
	});
	return freq;
  }
  
  function saveSongs(songs) {
	localStorage.setItem('jazzSongs', JSON.stringify(songs));
  }
  
  function loadSongs() {
	return JSON.parse(localStorage.getItem('jazzSongs') || '[]');
  }
  
  function createSectionField(label = '', chords = '') {
	const div = document.createElement('div');
	div.className = 'section-field';
	div.innerHTML = `
	  <input type="text" class="section-label" placeholder="Section (e.g. A, B)" value="${label}" required>
	  <input type="text" class="section-chords" placeholder="Chords (e.g. Cmaj7 Dm7 G7)" value="${chords}" required>
	  <button type="button" class="btn btn-discreet remove-section-btn">Remove</button>
	`;
	div.querySelector('.remove-section-btn').onclick = () => div.remove();
	return div;
  }
  
  function setupSectionFields() {
	const container = document.getElementById('sections-container');
	container.innerHTML = '';
	// Add one section by default
	container.appendChild(createSectionField());
  }
  
  document.getElementById('add-section-btn').onclick = function() {
	document.getElementById('sections-container').appendChild(createSectionField());
  };
  
  document.getElementById('delete-all-btn').onclick = function() {
	if (confirm('Are you sure you want to delete all songs? This cannot be undone.')) {
	  localStorage.removeItem('jazzSongs');
	  renderSongs();
	}
  };
  
  function renderSongs() {
	const songList = document.getElementById('song-list');
	songList.innerHTML = '';
	const songs = loadSongs();
  
	renderGlobalIntervalStats(); // <-- update global stats at every render
  
	if (songs.length === 0) {
	  songList.innerHTML = '<p class="empty-state">No songs yet. Add one using the form above!</p>';
	  return;
	}
  
	songs.forEach((song, idx) => {
	  let allChords = song.sections.flatMap(sec => Array.isArray(sec.chords) ? sec.chords : []);
	  const baseNotes = allChords.map(parseChordRoot).filter(x => x !== null);
	  const intervals = getIntervals(baseNotes);
	  const freq = intervalFrequency(intervals);
	  
	  const songDiv = document.createElement('div');
	  songDiv.className = 'song';
	  songDiv.tabIndex = 0;
	  
	  const sectionsSummary = song.sections.map(sec => 
		`<b>${sec.label}:</b> <em>${Array.isArray(sec.chords) ? sec.chords.join(' ') : ''}</em>`
	  ).join(' | ');
  
	  songDiv.innerHTML = `
		<div class="song-main">
		  <div class="song-info">
			<span class="song-title">${song.title}</span>
			<span class="song-sections">${sectionsSummary}</span>
		  </div>
		  <div class="song-summary-table">
			<table class="interval-table">
			  <tr><th>Int</th>${[0,1,2,3,4,5,6].map(i=>`<th>${i}</th>`).join('')}</tr>
			  <tr><th>Ct</th>${freq.map(f=>`<td>${f}</td>`).join('')}</tr>
			</table>
		  </div>
		  <button class="btn btn-danger delete-btn" data-idx="${idx}">Delete</button>
		</div>
		<div class="song-details"></div>
	  `;
  
	  // Click handler to expand/collapse details
	  songDiv.onclick = function(e) {
		// Don't trigger when clicking the delete button
		if (e.target.closest('.delete-btn')) return;
		
		const details = songDiv.querySelector('.song-details');
		const isExpanded = songDiv.classList.toggle('expanded');
		
		// Render details only on the first time it's expanded
		if (isExpanded && !details.hasChildNodes()) {
			details.innerHTML = renderSongDetails(song);
		}
	  };
  
	  // Keyboard accessibility for expansion
	  songDiv.onkeydown = function(e) {
		if (e.key === 'Enter' || e.key === ' ') {
		  e.preventDefault();
		  songDiv.click();
		}
	  };
  
	  // Attach delete handler
	  songDiv.querySelector('.delete-btn').onclick = function(e) {
		e.stopPropagation();
		if (confirm(`Are you sure you want to delete "${song.title}"?`)) {
		  const songs = loadSongs();
		  songs.splice(idx, 1);
		  saveSongs(songs);
		  renderSongs();
		}
	  };
	  
	  songList.appendChild(songDiv);
	});
  }
  
  function renderSongDetails(song) {
	// Render details as a table: each section is two rows (chords, intervals)
	let html = '<table class="song-details-table">';
	song.sections.forEach(section => {
	  let chordCells = '';
	  let intervalCells = '';
	  let prevBase = null;
  
	  section.chords.forEach((chord, i) => {
		const base = parseChordRoot(chord);
		chordCells += `<td>${chord}</td>`;
		if (i === 0 || base === null || prevBase === null) {
		  intervalCells += '<td>-</td>';
		} else {
		  let up = (base - prevBase + 12) % 12;
		  let down = (prevBase - base + 12) % 12;
		  let sign, val;
		  if (up === 6 && down === 6) {
			sign = '+';
			val = 6;
		  } else if (up <= down) {
			sign = '+';
			val = up > 6 ? 12 - up : up;
		  } else {
			sign = '-';
			val = down > 6 ? 12 - down : down;
		  }
		  intervalCells += `<td class="interval-value">${sign}${val}</td>`;
		}
		prevBase = base;
	  });
  
	  html += `
		<tr>
		  <th rowspan="2" class="section-header">${section.label}</th>
		  ${chordCells}
		</tr>
		<tr>${intervalCells}</tr>
	  `;
	});
	html += '</table>';
	return html;
  }
  
  document.querySelector('.add-song-form').onsubmit = function(e) {
	e.preventDefault();
	const titleInput = document.getElementById('song-title');
	const title = titleInput.value.trim();
	
	const sectionDivs = Array.from(document.querySelectorAll('#sections-container .section-field'));
	const sections = sectionDivs.map(div => ({
	  label: div.querySelector('.section-label').value.trim(),
	  chords: div.querySelector('.section-chords').value.trim().split(/\s+/).filter(x => x)
	})).filter(sec => sec.label && sec.chords.length > 0);
	
	if (!title || sections.length === 0) {
	  alert('Please provide a song title and at least one valid section.');
	  return;
	}
	
	const songs = loadSongs();
	songs.push({ title, sections });
	saveSongs(songs);
	renderSongs();
	
	this.reset();
	titleInput.focus();
	setupSectionFields();
  };
  
  window.onload = renderSongs;
  setupSectionFields();
  
  // --- GLOBAL INTERVAL STATS ---
  let normalizeIntervals = true;

  function computeGlobalIntervalStats(songs, normalize = true) {
	// Aggregate all intervals from all songs
	let allIntervals = [];
	songs.forEach(song => {
	  let allChords = song.sections.flatMap(sec => Array.isArray(sec.chords) ? sec.chords : []);
	  const baseNotes = allChords.map(parseChordRoot).filter(x => x !== null);
	  const intervals = getIntervals(baseNotes);
	  allIntervals.push(...intervals.map(i => (typeof i === 'object' ? i : {sign: '+', val: i}))); // always as object
	});
	let freq, labels, colors;
	if (normalize) {
	  // Group +n and -n (except tritone)
	  freq = Array(7).fill(0);
	  allIntervals.forEach(i => {
		if (i.val === 6) freq[6]++; // tritone
		else if (i.val >= 0 && i.val <= 6) freq[i.val]++;
	  });
	  labels = [0,1,2,3,4,5,6].map(i => `${i}`);
	  colors = ['#2980b9','#27ae60','#f39c12','#e67e22','#8e44ad','#c0392b','#7f8c8d'];
	} else {
	  // Separate +n and -n
	  freq = Array(13).fill(0); // +1..+6, -1..-6, 0
	  allIntervals.forEach(i => {
		if (i.val === 0) freq[0]++;
		else if (i.val === 6) freq[12]++; // +6 or -6 (tritone)
		else if (i.sign === '+') freq[i.val]++;
		else if (i.sign === '-') freq[6 + i.val]++;
	  });
	  labels = ['0','+1','+2','+3','+4','+5','+6','-1','-2','-3','-4','-5','-6'];
	  colors = ['#2980b9','#27ae60','#f39c12','#e67e22','#8e44ad','#c0392b','#7f8c8d',
		'#16a085','#2ecc71','#f1c40f','#e67e22','#9b59b6','#e74c3c'];
	}
	const total = freq.reduce((a, b) => a + b, 0);
	const pct = freq.map(f => total ? (f / total * 100) : 0);
	return { freq, pct, total, labels, colors };
  }
  
  function renderGlobalIntervalStats() {
	const songs = loadSongs();
	const { freq, pct, total, labels, colors } = computeGlobalIntervalStats(songs, normalizeIntervals);
	const barDiv = document.getElementById('global-interval-bar');
	if (!barDiv) return;
	if (total === 0) {
	  barDiv.innerHTML = '<p class="empty-state">No intervals yet.</p>';
	  return;
	}
	// Render bar only, skip 0% intervals
	let bar = '<div id="interval-bar-rect" style="display:flex; height:40px; width:350px; border-radius:8px; overflow:hidden; box-shadow:0 1px 4px #0001; border:1px solid #ddd; position:relative;">';
	for (let i = 0; i < freq.length; ++i) {
	  if (pct[i] > 0) {
		bar += `<div class="interval-bar-segment" data-label="${labels[i]}" data-pct="${pct[i]}" style="background:${colors[i]};width:${pct[i]}%;height:100%;display:inline-block;cursor:pointer;"></div>`;
	  }
	}
	bar += '</div>';
	// Add legend
	bar += '<div style="display:flex;gap:0.5em;margin-top:0.5em;flex-wrap:wrap;">' +
	  labels.map((l,i)=> pct[i]>0 ? `<span style=\"display:inline-flex;align-items:center;\"><span style=\"display:inline-block;width:1.2em;height:1.2em;background:${colors[i]};margin-right:0.3em;border-radius:2px;\"></span>${l}</span>` : '').join('') + '</div>';
	// Add toggle button
	bar = `<h2 style=\"margin-right:1em;margin-bottom:0.5em;display:inline\">Interval Distribution</h2><button id="toggle-normalize-btn" class="btn btn-discreet" style="margin-bottom:0.7em;">${normalizeIntervals ? '+n/-n ' : 'Normalize'}</button><br/>` + bar;
	barDiv.innerHTML = bar;

	// Popup for hover
	let popup = document.getElementById('interval-hover-popup');
	if (!popup) {
	  popup = document.createElement('div');
	  popup.id = 'interval-hover-popup';
	  popup.style.position = 'fixed';
	  popup.style.pointerEvents = 'none';
	  popup.style.background = '#fff';
	  popup.style.border = '1px solid #bbb';
	  popup.style.borderRadius = '6px';
	  popup.style.boxShadow = '0 2px 8px #0002';
	  popup.style.padding = '0.5em 1em';
	  popup.style.fontSize = '1em';
	  popup.style.zIndex = 1000;
	  popup.style.display = 'none';
	  document.body.appendChild(popup);
	}
	document.querySelectorAll('.interval-bar-segment').forEach(seg => {
	  seg.onmousemove = e => {
		const label = seg.getAttribute('data-label');
		const pctVal = parseFloat(seg.getAttribute('data-pct')).toFixed(1);
		popup.innerHTML = `<b>Interval ${label}</b><br>${pctVal}%`;
		popup.style.display = 'block';
		popup.style.left = (e.clientX + 12) + 'px';
		popup.style.top = (e.clientY + 12) + 'px';
	  };
	  seg.onmouseleave = () => { popup.style.display = 'none'; };
	});
	// Toggle button
	document.getElementById('toggle-normalize-btn').onclick = function() {
	  normalizeIntervals = !normalizeIntervals;
	  renderGlobalIntervalStats();
	};
  }
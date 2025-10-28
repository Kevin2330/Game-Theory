(() => {
  const margin = { top: 40, right: 200, bottom: 40, left: 80 };
  const svg = d3.select('#tree');
  const svgNode = svg.node();
  const bounding = svgNode.getBoundingClientRect();
  const baseWidth = bounding.width || 960;
  const baseHeight = bounding.height || 600;
  svg.attr('viewBox', [0, 0, baseWidth, baseHeight]);

  const gLink = svg
    .append('g')
    .attr('class', 'links')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const gNode = svg
    .append('g')
    .attr('class', 'nodes')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const treeLayout = d3.tree().nodeSize([70, 150]);
  const diagonal = d3
    .linkHorizontal()
    .x((d) => d.y)
    .y((d) => d.x);

  const boardElement = document.getElementById('board');
  const statusElement = document.getElementById('status');
  const pathElement = document.getElementById('path');

  const winningLines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  let nodeId = 0;
  let selectedNode = null;

  initializeBoard();

  const rootData = createNode('.........', null, 0);
  const root = d3.hierarchy(rootData);
  root.x0 = baseHeight / 2;
  root.y0 = 0;
  ensureChildren(root);
  if (root._children) {
    root.children = root._children;
    root._children = null;
  }
  update(root);
  setSelectedNode(root);

  function initializeBoard() {
    boardElement.innerHTML = '';
    for (let i = 0; i < 9; i += 1) {
      const cell = document.createElement('div');
      cell.className = 'board-cell';
      boardElement.appendChild(cell);
    }
  }

  function analyzeBoard(state) {
    const cells = state.split('');
    let winner = null;
    let winningPath = [];
    for (const line of winningLines) {
      const [a, b, c] = line;
      if (cells[a] !== '.' && cells[a] === cells[b] && cells[a] === cells[c]) {
        winner = cells[a];
        winningPath = line;
        break;
      }
    }

    const filled = cells.filter((c) => c !== '.').length;
    const nextPlayer = filled % 2 === 0 ? 'X' : 'O';
    const isTerminal = Boolean(winner) || filled === 9;
    const isDraw = isTerminal && !winner;
    const openMoves = 9 - filled;

    let statusMessage;
    if (winner) {
      statusMessage = `${winner} wins`;
    } else if (isDraw) {
      statusMessage = 'Draw';
    } else {
      statusMessage = `${nextPlayer} to move — ${openMoves} open move${openMoves === 1 ? '' : 's'}`;
    }

    return {
      winner,
      winningPath,
      isTerminal,
      isDraw,
      nextPlayer: isTerminal ? null : nextPlayer,
      openMoves,
      statusMessage
    };
  }

  function createNode(state, move, depth) {
    const analysis = analyzeBoard(state);
    const label = analysis.isTerminal
      ? analysis.winner
        ? `${analysis.winner} wins`
        : 'Draw'
      : `${analysis.nextPlayer} to move`;

    return {
      key: ++nodeId,
      state,
      move,
      depth,
      label,
      ...analysis
    };
  }

  function generateChildren(nodeData) {
    if (nodeData.isTerminal) {
      return [];
    }
    const { nextPlayer } = nodeData;
    const children = [];
    for (let i = 0; i < 9; i += 1) {
      if (nodeData.state[i] === '.') {
        const nextState = `${nodeData.state.slice(0, i)}${nextPlayer}${nodeData.state.slice(i + 1)}`;
        children.push(
          createNode(nextState, { player: nextPlayer, index: i }, nodeData.depth + 1)
        );
      }
    }
    return children;
  }

  function ensureChildren(node) {
    if (node.data.isTerminal || node._children || node.children) {
      return;
    }
    const childrenData = generateChildren(node.data);
    if (!childrenData.length) {
      node._children = null;
      return;
    }
    node._children = childrenData.map((childData) => {
      const child = d3.hierarchy(childData);
      child.parent = node;
      child.x = node.x;
      child.y = node.y;
      return child;
    });
  }

  function click(event, node) {
    if (node.children) {
      node._children = node.children;
      node.children = null;
    } else {
      ensureChildren(node);
      if (node._children) {
        node.children = node._children;
        node._children = null;
      }
    }
    setSelectedNode(node);
    update(node);
  }

  function update(source) {
    treeLayout(root);
    const nodes = root.descendants().reverse();
    const links = root.links();

    let left = Infinity;
    let right = -Infinity;
    nodes.forEach((d) => {
      if (d.x < left) left = d.x;
      if (d.x > right) right = d.x;
    });

    const heightNeeded = right - left + margin.top + margin.bottom;
    const shiftX = margin.top - left;
    const maxDepth = nodes.reduce((max, d) => Math.max(max, d.depth), 0);
    const widthNeeded = maxDepth * 150 + margin.left + margin.right;

    svg.attr('viewBox', [0, 0, Math.max(widthNeeded, baseWidth), Math.max(heightNeeded, baseHeight)]);

    nodes.forEach((d) => {
      d.x += shiftX;
      d.y = d.depth * 150;
    });

    const nodeSelection = gNode.selectAll('g.node').data(nodes, (d) => d.data.key);

    const nodeEnter = nodeSelection
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', () => `translate(${source.y0 ?? source.y},${source.x0 ?? source.x})`)
      .on('click', click)
      .on('mouseenter', (event, d) => showBoard(d.data, d))
      .on('mouseleave', () => {
        if (selectedNode) {
          showBoard(selectedNode.data, selectedNode);
        }
      });

    nodeEnter
      .append('circle')
      .attr('r', 1e-6)
      .attr('fill', (d) => circleFill(d.data))
      .attr('stroke', (d) => circleStroke(d.data));

    nodeEnter
      .append('text')
      .attr('dy', '0.35em')
      .attr('x', (d) => (d.children || d._children ? -16 : 16))
      .style('text-anchor', (d) => (d.children || d._children ? 'end' : 'start'))
      .text((d) => d.data.label);

    const nodeMerge = nodeEnter.merge(nodeSelection);

    nodeMerge
      .transition()
      .duration(300)
      .attr('transform', (d) => `translate(${d.y},${d.x})`);

    nodeMerge
      .select('circle')
      .transition()
      .duration(300)
      .attr('r', 18)
      .attr('fill', (d) => circleFill(d.data))
      .attr('stroke', (d) => circleStroke(d.data));

    nodeMerge
      .select('circle')
      .classed('selected', (d) => d === selectedNode);

    nodeMerge
      .select('text')
      .attr('x', (d) => (d.children || d._children ? -16 : 16))
      .style('text-anchor', (d) => (d.children || d._children ? 'end' : 'start'));

    nodeSelection
      .exit()
      .transition()
      .duration(300)
      .attr('transform', () => `translate(${source.y},${source.x})`)
      .remove();

    const linkSelection = gLink.selectAll('path.link').data(links, (d) => d.target.data.key);

    const linkEnter = linkSelection
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', () => {
        const o = { x: source.x0 ?? source.x, y: source.y0 ?? source.y };
        return diagonal({ source: o, target: o });
      });

    linkEnter
      .merge(linkSelection)
      .transition()
      .duration(300)
      .attr('d', (d) => diagonal({ source: { x: d.source.x, y: d.source.y }, target: { x: d.target.x, y: d.target.y } }));

    linkSelection
      .exit()
      .transition()
      .duration(300)
      .attr('d', () => {
        const o = { x: source.x, y: source.y };
        return diagonal({ source: o, target: o });
      })
      .remove();

    nodes.forEach((d) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  function circleFill(data) {
    if (data.isTerminal) {
      if (data.winner === 'X') return '#ffd43b';
      if (data.winner === 'O') return '#74c0fc';
      return '#ced4da';
    }
    return '#fff';
  }

  function circleStroke(data) {
    if (data.isTerminal) {
      if (data.winner === 'X') return '#e67700';
      if (data.winner === 'O') return '#1864ab';
      return '#495057';
    }
    return getPlayerColor(data.nextPlayer);
  }

  function getPlayerColor(player) {
    return player === 'O' ? '#1c7ed6' : '#0b7285';
  }

  function setSelectedNode(node) {
    selectedNode = node;
    gNode.selectAll('circle').classed('selected', (d) => d === selectedNode);
    showBoard(node.data, node);
  }

  function showBoard(data, node) {
    const cells = Array.from(boardElement.children);
    const winningSet = new Set(data.winningPath ?? []);
    data.state.split('').forEach((value, index) => {
      const cell = cells[index];
      cell.textContent = value === '.' ? '' : value;
      cell.classList.toggle('win', winningSet.has(index));
    });

    statusElement.textContent = data.statusMessage;

    const pathMoves = describePath(node ?? selectedNode);
    if (pathMoves.length === 0) {
      pathElement.innerHTML = '<strong>Start position.</strong>';
    } else {
      const segments = pathMoves.map((move) => `<span>${move}</span>`).join('');
      pathElement.innerHTML = `<strong>Sequence:</strong> ${segments}`;
    }
  }

  function describePath(node) {
    if (!node) return [];
    const moves = [];
    let current = node;
    while (current && current.data.move) {
      moves.push(describeMove(current.data.move));
      current = current.parent;
    }
    return moves.reverse();
  }

  function describeMove(move) {
    if (!move) return '';
    const row = Math.floor(move.index / 3) + 1;
    const col = (move.index % 3) + 1;
    return `${move.player} → row ${row}, col ${col}`;
  }
})();

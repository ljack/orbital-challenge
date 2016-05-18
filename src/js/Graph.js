export class Graph {
    constructor(containerId) {
        this.neighbors = {}; // Key = vertex, value = array of neighbors.
        this.containerId = containerId || "display";
    }

    addEdge(u, v) {
        // console.log("u="+u+" v="+v+" neighbors=",this.neighbors);
        if (this.neighbors[u] === undefined) { // Add the edge u -> v.
            this.neighbors[u] = [];
        }
        this.neighbors[u].push(v);
        if (this.neighbors[v] === undefined) { // Also add the edge v -> u in order
            this.neighbors[v] = []; // to implement an undirected graph.
        } // For a directed graph, delete
        this.neighbors[v].push(u); // these four lines.
    }


 
    bfs(source) {
        let queue = [{
            vertex: source,
            count: 0
        }];
        let visited = {
            source: true
        };
        let tail = 0;

        while (tail < queue.length) {
            let u = queue[tail].vertex;
            let count = queue[tail++].count; // Pop a vertex off the queue.
            this.prints('distance from ' + source + ' to ' + u + ': ' + count);
            if( !this.neighbors[u] ) return;
            this.neighbors[u].forEach(function(v) {
                if (!visited[v]) {
                    visited[v] = true;
                    queue.push({
                        vertex: v,
                        count: count + 1
                    });
                }
            });
        }
    }

    shortestPath( source, target) {
        if (source == target) { // Delete these four lines if
            this.print(source); // you want to look for a cycle
            return; // when the source is equal to
        } // the target.
        if( !this.neighbors) {
            return;
        }
        let queue = [source],
            visited = {
                source: true
            },
            predecessor = {},
            tail = 0;
        while (tail < queue.length) {
            let u = queue[tail++]; // Pop a vertex off the queue.
            
            let neighbors = this.neighbors[u];
            
            for (let i = 0; i < neighbors.length; ++i) {
                let v = neighbors[i];
                if (visited[v]) {
                    continue;
                }
                visited[v] = true;
                if (v === target) { // Check if the path is complete.
                    let path = [v]; // If so, backtrack through the path.
                    while (u !== source) {
                        path.push(u);
                        u = predecessor[u];
                    }
                    path.push(u);
                    path.reverse();
                    this.prints(path.join(' , '));
                    return path;
                }
                predecessor[v] = u;
                queue.push(v);
            }
        }
        this.prints('there is no path from ' + source + ' to ' + target);
    }

     prints(s) { // A quick and dirty way to display output.
        s = s || '';
        console.log(s);
        document.getElementById(this.containerId).innerHTML += s + '<br>';
    }

}

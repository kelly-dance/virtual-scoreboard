const express = require('express');
const { parse } = require('csv-parse');
const fs = require('fs');

const startTime = 1699403400e3;

(async()=>{
	const data = await new Promise(resolve => {
		const csvData = [];
		fs.createReadStream('./rmc2023.csv')
			.pipe(parse())
			.on('data', row => {
				csvData.push({
					name: row[1],
					problems: row.slice(6).map(s => {
						const match = s.match(/(\d+)\n(\d+) min/);
						if(match)
							return { attempts: parseInt(match[1]), time: parseInt(match[2]) }
						return undefined;
					})
				});        
			})
			.on('end', () => resolve(csvData));
	});

	const numProblems = data[0].problems.length;
	const firsts = new Array(numProblems).fill(301);
	for(const { problems } of data){
		for(let i = 0; i < numProblems; i++){
			if(problems[i] == undefined) continue;
			firsts[i] = Math.min(firsts[i], problems[i].time);
		}
	}

	const getLiveData = () => {
		const time = Date.now();
		const minute = Math.floor((time - startTime)/60e3);
		const ranks = data.map(({ name, problems }) => {
			problems = problems.map((p,i) => {
				if(!p) return undefined;
				if(p.time > minute) return undefined;
				return {
					...p,
					first: firsts[i] == p.time
				};
			});
			let count = 0;
			let penalty = 0;
			for(let i = 0; i < numProblems; i++){
				if(problems[i] != undefined){
					count++;
					penalty += 20 * (problems[i].attempts - 1) + problems[i].time;
				}
			}
			return {
				name,
				count,
				penalty,
				problems,
			}
		});
		ranks.sort((a, b) => {
			if(a.count > b.count) return -1;
			if(a.count< b .count) return 1;
			if(a.penalty < b.penalty) return -1;
			if(a.penalty > b.penalty) return 1;
			return 0; // not implementing full tie breaker rules 
		});

		const solveCounts = new Array(numProblems).fill(0);
		for(const {problems} of ranks){
			for(let i = 0; i < numProblems; i++){
				if(problems[i] != undefined) solveCounts[i]++;
			}
		}

		return {
			solveCounts,
			minute,
			ranks,
		};
	}

	const app = express();
	const port = 5003;

	app.set('view engine', 'ejs');

	app.get('/', (req, res) => {
		res.render('index', { numProblems, ...getLiveData() });
	});

	app.get('/data', (req, res) => {
		res.json(data);
	});

	app.get('/live', (req, res) => {
		res.json(getLiveData());
	});

	app.listen(port, () => {
		console.log(`Virtual Scoreboard listening on port ${port}`);
	});


})();
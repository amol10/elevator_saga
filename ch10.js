{
	// strategy: 

	init: function(elevators, floors) {
		var up_waiting_floors = [];
		var down_waiting_floors = [];
		var top_floor = floors.length - 1;
		var hold = false;
		var hold_delay = 300;


		var prio_offload_enabled = false;
		var prio_offload_elv_list = [1];			// elevators that use priority offload
		var prio_offload_threshold = 0.5;			// min laod factor at which we offload on priority
		var prio_offload_min_load_factor = 0.3;		// min ratio of passengers that need to be going to a single floor


		for (i=0; i < elevators.length; i++) {
			elevator = elevators[i];
			elevator.idle = true;
			elevator.upQueue = [];
			elevator.downQueue = [];
			elevator.num = i;
			elevator.prio_offload = false;
			elevator.dir = "none";

			elevator.floor_loads = new Array(floors.length);			// apprx. load headed for each of the floors
			elevator.floor_loads.fill(0);

			//console.log("elv: ", i, " max: ", elevator.maxPassengerCount());

			// Whenever the elevator is idle (has no more queued destinations) ...
			elevator.on("idle", function() {
				this.idle = true;
				this.goingUpIndicator(true);
				this.goingDownIndicator(true);

				handle_idle(this);
			});

			elevator.on("floor_button_pressed", function(floorNum) {
				handle_fl_btn_press(this, floorNum);
			});
			
			elevator.on("stopped_at_floor", function(floorNum) {
				handle_stop(this, floorNum);
			});

			elevator.on("passing_floor", function(floorNum, dir) {
				handle_passing_floor(floorNum, dir, this);
			});
		}

		for (i=0; i < floors.length; i++) {
			fl = floors[i];
			fl.on("up_button_pressed", function() {
				handle_call("up", this.floorNum());
				//console.log("up button pressed: " + this.floorNum());
			});

			fl.on("down_button_pressed", function() {
				handle_call("down", this.floorNum());
				//console.log("down button pressed: " + this.floorNum());
			});
		}

		function handle_passing_floor(floorNum, dir, elevator) {
				var wf;
				elevator.dir = dir;

				if (dir == "up")
						wf = up_waiting_floors;
				else if (dir == "down") {
						wf = down_waiting_floors;
						//elevator.num == 1 && console.log("down, passing fl: ", floorNum, " wf: ", JSON.stringify(down_waiting_floors));
				}

				if (wf.length > 0 && can_accomodate(elevator)) {
					floorNum = pop_if_in_array(floorNum, wf);
					if (floorNum > -1)
						elevator.goToFloor(floorNum, true);
				}
		}

		function handle_stop(elevator, floorNum) {
			delete_if_in_array(floorNum, elevator.upQueue);
			delete_if_in_array(floorNum, elevator.downQueue);

			//elevator.num == 1 && console.log("stopped, dir: ", elevator.dir);

			if (elevator.dir == "up")
				delete_if_in_array(floorNum, up_waiting_floors);
			else if (elevator.dir == "down")
				delete_if_in_array(floorNum, down_waiting_floors);
				//console.log("deleted from down waiting floors: ", floorNum);

			elevator.floor_loads[floorNum] = 0;

	 		if (elevator.prio_offload) {
				elevator.prio_offload = false;
				repartition_queues(elevator);
				select_queue(elevator);
			} else {		
				switch_dest_queue(elevator);
			}

			if (floorNum == 0) {
					elevator.goingDownIndicator(false);
					elevator.goingUpIndicator(true);
			}

			if (floorNum == floors.length - 1) {
					elevator.goingDownIndicator(true);
					elevator.goingUpIndicator(false);
			}

			//console.log("elv: ", elevator.num, "stop, up: ", JSON.stringify(elevator.upQueue), " down: ", JSON.stringify(elevator.downQueue));
			//elevator.num == 1 && console.log("stop, load factor: ", elevator.loadFactor(), " fl: ", elevator.currentFloor());
		}

		// when elevator jumps to an off-queue destination as part of priority offload,
		// upQueue and downQueue become invalid
		function repartition_queues(elevator) {
			cf = elevator.currentFloor();
			uq = elevator.upQueue;
			dq = elevator.downQueue;
			all = uq.concat(dq);

			uq = [];
			dq = [];

			for (i=0; i < all.length; i++) {
					if (all[i] < cf) {
						dq.push(all[i]);
					} else {
						uq.push(all[i]);
					}
			}

			uq.sort(function(a, b){return a - b});
			dq.sort(function(a, b){return b - a});

		}

		// select up/down queue based on apprx. passenger count
		function select_queue(elevator) {
			var uq_passenger_count = 0;
			var dq_passenger_count = 0;

			// get counts

			if (uq_passenger_count > dq_passenger_count) {
					elevator.queue = elevator.upQueue;
			} else {
					elevator.queue = elevator.downQueue;
			}
			elevator.checkDestinationQueue();	
		}

		function can_accomodate(elevator) {
			per_passenger_load = (1 / elevator.maxPassengerCount()) + 0.1;
			return (1 - elevator.loadFactor()) >= per_passenger_load;
		}

		function go_to_floor(elevator, floorNum) {
			handle_fl_btn_press(elevator, floorNum);
		}
			
		function handle_fl_btn_press(elevator, floorNum) {
			//console.log("up q: ", JSON.stringify(elevator.upQueue), " down q: ", JSON.stringify(elevator.downQueue));
			//elevator.num == 1 && console.log("fl btn pressed: ", floorNum);

			if (in_array(floorNum, elevator.upQueue) || in_array(floorNum, elevator.downQueue)) {			
				return;	
			}

			if (floorNum > elevator.currentFloor()) {
				elevator.upQueue.push(floorNum);
				elevator.upQueue.sort(function(a, b){return a - b});
			} else {
				elevator.downQueue.push(floorNum);
				elevator.downQueue.sort(function(a, b){return b - a});
			}

			if (elevator.destinationDirection() == "stopped") {
				//console.log("fl btn prs, elvtr stopped");
				if (elevator.upQueue.length >= elevator.downQueue.length) {
					set_dest_queue(elevator, "up");				
				} else {
					set_dest_queue(elevator, "down");
				}
			}
		}
			
		function set_dest_queue(elevator, dir) {
			var queue;

			function setq() {
				elevator.destinationQueue = queue;
				elevator.checkDestinationQueue();

				prio_offload_enabled && setTimeout(update_floor_loads, 100);
			}

			if (dir == "up") {
				queue = elevator.upQueue;
				elevator.dir = "up";
				elevator.goingDownIndicator(false);
				elevator.goingUpIndicator(true);		
			} else if (dir == "down") {
				queue = elevator.downQueue;
				elevator.dir = "down";
				elevator.goingUpIndicator(false);
				elevator.goingDownIndicator(true);
			} else {
			}

			if (elevator.currentFloor() == 0 && hold && can_accomodate(elevator)) {
				elevator.destinationQueue = [];
				elevator.checkDestinationQueue();

				setTimeout(setq, hold_delay);
			} else {
				setq();
			}
		}

		function update_floor_loads(elevator) {
				//elevator.num == 1 && console.log("updt, load factor: ", elevator.loadFactor(), " fl: ", elevator.currentFloor());
				fl = elevator.floor_loads;

				// get pressed floors (gpf)
				pf = elevator.getPressedFloors();

				// new floors = gpf - (floors with > 0 load in list)
				nf = pf.filter(function(f) { return elevator.floor_loads[f] == 0 });

				// get new load = elv load - sum of all loads in list (gnl)
				nl = elevator.loadFactor() - elevator.floor_loads.reduce(function(t, i) { return t + i });

				// for each new floor, assign 1 pass wt to it, subtract it from gnl
				for (f in nf) {
					//fl[f] = 1 p wt;
					//nl -= 1 p wt;	
				}

				// distribute reamining load equally among all floors
				fl = fl.map(function(i) { return i + (nl / pf.length) });
		}

		// if an elevator has many people destined for a particular floor and
		// elevator's load factor is greater than threshold, then, go that floor first
		function prio_offload(elevator) {
			if (!prio_offload_enabled || !in_array(elevator.num, prio_offload_elv_list) || elevator.loadFactor() < prio_offload_threshold) {
				return;	
			}

			min_passenger_count = elevator.maxPassengerCount() * prio_offload_min_load_factor;

			// get the floor with max p count (p count >= min)
			
		
			elevator.goToFloor(floorNum);
			elevator.prio_offload = true;	

		}
			
		function switch_dest_queue(elevator) {
			if (elevator.upQueue.length == 0 && elevator.downQueue.length > 0) {
				set_dest_queue(elevator, "down");
			} else if (elevator.downQueue.length == 0 && elevator.upQueue.length > 0) {
				set_dest_queue(elevator, "up");
			} else if (elevator.downQueue.length == 0 && elevator.upQueue.length == 0) {
				elevator.goingUpIndicator(true);
				elevator.goingDownIndicator(true);
			}
		}

		function handle_call(dir, floorNum) {
			for(i=0; i < elevators.length; i++) {
				elevator = elevators[i];

				if (elevator.idle) {
					elevator.idle = false;
					//go_to_floor(elevator, floorNum);
					go_to_floor2(elevator, floorNum);
					return;
				}
			}
			if (dir == "up")
					up_waiting_floors.push(floorNum);
			if (dir == "down")
					down_waiting_floors.push(floorNum);
					//console.log("added to down waiting floors: ", floorNum);
		};

		function handle_idle_old(elevator) {
			wf = up_waiting_floors.concat(down_waiting_floors);

			if (wf.length == 0) {
				return;
			}

			cf = elevator.currentFloor();
			diff = wf.map(function(i) { return Math.abs(i - cf) });

			min_idx = min_index(diff);
			nearest_floor = wf[min_idx];

			elevator.goToFloor(nearest_floor);
		}

		function handle_idle(elevator) {
			wf = up_waiting_floors.concat(down_waiting_floors);
			if (wf.length == 0)
					return;

			uf = [];
			df = [];

			for (f in wf) {
				if (f < elevator.currentFloor())
					df.push(f);
				else
					uf.push(f);
			}

			var floorNum;
			if (df.length > uf.length)
					floorNum = Math.min(...df);
			else
					floorNum = Math.max(...uf);

			go_to_floor2(elevator, floorNum);
		}

		function go_to_floor2(elevator, floorNum) {
			if (elevator.currentFloor() < floorNum) {
					elevator.goingUpIndicator(true);
					elevator.goingDownIndicator(false);
			} else {
					elevator.goingDownIndicator(true);
					elevator.goingUpIndicator(false);
			}
			elevator.idle = false;
			elevator.goToFloor(floorNum, true);
		}
		
		function delete_if_in_array(val, arr) {
			var index = arr.indexOf(val);
			if (index > -1) {
				arr.splice(index, 1);
			}
		}
		
		function add_if_not_in_array(val, arr) {
			var index = arr.indexOf(val);
			if (index < 0) {
				arr.push(val);
				return true;
			}
			return false;
		}

		function in_array(val, arr) {
			return arr.indexOf(val) > -1
		}

		function pop_if_in_array(val, arr) {
			var index = arr.indexOf(val);
			if (index < 0)
					return -1;
			arr.splice(index, 1);
			return val;
		}

		function min_index(arr) {
			var min = Number.MAX_SAFE_INTEGER;
			var index;

			for (i=0; i < arr.length; i++) {
				if (arr[i] < min) {
					min = arr[i];
					index = i;
				}
			}
			return index;
		}
	},

	update: function(dt, elevators, floors) {
		// We normally don't need to do anything here
	}
}

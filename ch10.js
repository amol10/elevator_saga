{
	// strategy: 

	init: function(elevators, floors) {
		var waiting_floors = [];
		var top_floor = floors.length - 1;
		var hold = true;
		var hold_delay = 300;


		var prio_offload_enabled = true;
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

			elevator.floor_loads = new Array(floor.length);			// apprx. load headed for each of the floors
			elevator.floor_loads.fill(0);

			//console.log("elv: ", i, " max: ", elevator.maxPassengerCount());

			// Whenever the elevator is idle (has no more queued destinations) ...
			elevator.on("idle", function() {
				this.idle = true;
				handle_call("", -1);
			});

			elevator.on("floor_button_pressed", function(floorNum) {
				handle_fl_btn_press(this, floorNum);
			});
			
			elevator.on("stopped_at_floor", function(floorNum) {
				handle_stop(this, floorNum);
			});

			elevator.on("passing_floor", function(floorNum, direction) {
				if (waiting_floors.length > 0 && can_accomodate(this)) {
					var fl_index = waiting_floors.indexOf(floorNum);
					if (fl_index > -1) {
						waiting_floors.splice(fl_index, 1);
						this.goToFloor(floorNum, true);
					}
				}
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
		
		function handle_stop(elevator, floorNum) {
			delete_if_in_array(floorNum, elevator.upQueue);
			delete_if_in_array(floorNum, elevator.downQueue);

			var fl_index = waiting_floors.indexOf(floorNum);
			if (fl_index > -1) {
				waiting_floors.splice(fl_index, 1);
			}
		
			elevator.floor_loads[floorNum] = 0;

	 		if (elevator.prio_offload) {
				elevator.prio_offload = false;
				repartition_queues(elevator);
				select_queue(elevator);
			} else {		
				switch_dest_queue(elevator);
			}
			//console.log("elv: ", elevator.num, "stop, up: ", JSON.stringify(elevator.upQueue), " down: ", JSON.stringify(elevator.downQueue));
			elevator.num == 1 && console.log("stop, load factor: ", elevator.loadFactor(), " fl: ", elevator.currentFloor());
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
			uq_passenger_count = 0;
			dq_passenger_count = 0;

			// get counts

			if (uq_passenger_count > dq_passenger_count) {
					elevator.queue = elevator.upQueue;
			} else
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
			elevator.num == 1 && console.log("fl btn pressed: ", floorNum);

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
				elevator.goingDownIndicator(false);
				elevator.goingUpIndicator(true);		
			} else if (dir == "down"){
				queue = elevator.downQueue;
				elevator.goingUpIndicator(false);
				elevator.goingDownIndicator(true);
			}

			if (elevator.currentFloor() == 0 && hold && can_accomodate(elevator)) {
				elevator.destinationQueue = [];
				elevator.checkDestinationQueue();

				setTimeout(setq, hold_delay);
			} else {
				setq()
			}
		}

		function update_floor_loads(elevator) {
				elevator.num == 1 && console.log("updt, load factor: ", elevator.loadFactor(), " fl: ", elevator.currentFloor());
				fl = elevator.floor_loads;

				// get pressed floors (gpf)
				pf = elevator.getPressedFloors();

				// new floors = gpf - (floors with > 0 load in list)
				nf = pf.filter(function(f) { return elevator.floor_loads[f] == 0 });

				// get new load = elv load - sum of all loads in list (gnl)
				nl = elevator.loadFactor() - elevator.floor_loads.reduce(function(t, i) { return t + i });

				// for each new floor, assign 1 pass wt to it, subtract it from gnl
				for (f in nf) {
					fl[f] = 1 p wt;
					nl -= 1 p wt;	
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
			}
			if (elevator.downQueue.length == 0 && elevator.upQueue.length > 0) {
				set_dest_queue(elevator, "up");
			}
		}

		function handle_call(dir, floorNum) {
			for(i=0; i < elevators.length; i++) {
				elevator = elevators[i];

				if (elevator.idle) {
					if (floorNum == -1) {
						if (waiting_floors.length > 0) {
							floorNum = waiting_floors.shift();
						} else {
							return;
						}					  
					}		   
					elevator.idle = false;
					go_to_floor(elevator, floorNum);
					return;
				}
			}
			waiting_floors.push(floorNum);
			//console.log("waiting floor ", floorNum);
		};
		
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
	},

	update: function(dt, elevators, floors) {
		// We normally don't need to do anything here
	}
}

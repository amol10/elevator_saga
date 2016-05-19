{
	init: function(elevators, floors) {
		var waiting_floors = [];
		var top_floor = floors.length - 1;
		var hold = true;
		var hold_delay = 500;

		for (i=0; i < elevators.length; i++) {
			elevator = elevators[i];
			elevator.idle = true;
			elevator.upQueue = [];
			elevator.downQueue = [];
			elevator.num = i;

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
				if (waiting_floors.length > 0 && can_accomodate(this) > 1) {
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
				   
			switch_dest_queue(elevator);
			//console.log("elv: ", elevator.num, "stop, up: ", JSON.stringify(elevator.upQueue), " down: ", JSON.stringify(elevator.downQueue));
		}

		function can_accomodate(elevator) {
			return elevator.loadFactor() < 1	
		}

		function go_to_floor(elevator, floorNum) {
			handle_fl_btn_press(elevator, floorNum);
		}
			
		function handle_fl_btn_press(elevator, floorNum) {
			//console.log("up q: ", JSON.stringify(elevator.upQueue), " down q: ", JSON.stringify(elevator.downQueue));

			if (in_array(floorNum, elevator.upQueue) || in_array(floorNum, elevator.downQueue)) {			
				return;	
			}

			if (floorNum > elevator.currentFloor()) {
				elevator.upQueue.push(floorNum);
				elevator.upQueue.sort();
			} else {
				elevator.downQueue.push(floorNum);
				elevator.downQueue.sort(function(a, b){return b - a});
			}

			if (elevator.destinationDirection() == "stopped") {
				if (elevator.upQueue.length >= elevator.downQueue.length) {
					set_dest_queue(elevator, elevator.upQueue);				
				} else {
					set_dest_queue(elevator, elevator.downQueue);
				}
			}
		}
			
		function set_dest_queue(elevator, queue) {
			function setq() {
				elevator.destinationQueue = queue;
				elevator.checkDestinationQueue();
			}

			if (hold && can_accomodate(elevator)) {
				elevator.destinationQueue = [];
				elevator.checkDestinationQueue();

				setTimeout(setq, hold_delay);
			} else {
				setq()
			}
		}
			
		function switch_dest_queue(elevator) {
			if (elevator.upQueue.length == 0 && elevator.downQueue.length > 0) {
				set_dest_queue(elevator, elevator.downQueue);
			}
			if (elevator.downQueue.length == 0 && elevator.upQueue.length > 0) {
				set_dest_queue(elevator, elevator.upQueue);
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

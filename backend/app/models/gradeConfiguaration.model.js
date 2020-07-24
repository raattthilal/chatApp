module.exports = function GradeConfiguaration(sequelize) {
    var Sequelize = sequelize.constructor;
    var ret =
      sequelize.define('gradeCOnfiguaration', {
        start_value: {
          type: Sequelize.INTEGER
        },
        end_value: {
          type: Sequelize.INTEGER
        },
        grade: {
          type: Sequelize.STRING
        },
        status: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
        modified_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
  
      }, {
        tableName: 'grade_configuaration',
        timestamps: false
  
      });
    return ret;
  }
  